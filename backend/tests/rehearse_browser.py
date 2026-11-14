"""Offline Chromium rehearsal against a running classroom build.

Install the optional playwright==1.56.0 test dependency and use installed Chrome.
"""

import os
import re
from time import monotonic
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

URL = os.environ.get("SMART_WRITING_URL", "http://127.0.0.1:8000")


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome")
        fallback = browser.new_context()
        fallback.route("**/models/**", lambda route: route.abort())
        fallback_page = fallback.new_page()
        fallback_page.goto(URL)
        fallback_editor = fallback_page.get_by_label("Untitled page")
        fallback_editor.fill("The results show that the ")
        fallback_editor.press("End")
        ghost = fallback_page.locator(".ghost[data-source=ngram]")
        expect(ghost).not_to_be_empty()
        word = ghost.inner_text()
        fallback_editor.press("Tab")
        expect(fallback_editor).to_have_value("The results show that the " + word + " ")
        fallback.close()
        print("N-gram fallback supplies a Tab completion when the neural model cannot load.")

        context = browser.new_context(viewport={"width": 1366, "height": 768})
        blocked = []
        errors = []
        logs = []

        def local_only(route):
            if urlparse(route.request.url).netloc == urlparse(URL).netloc:
                route.continue_()
            else:
                blocked.append(route.request.url)
                route.abort()

        context.route("**/*", local_only)
        page = context.new_page()
        page.on("console", lambda msg: logs.append(msg.text))
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="domcontentloaded")
        editor = page.get_by_label("Untitled page")

        response = page.request.get(URL)
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
        assert "wasm-unsafe-eval" in response.headers["content-security-policy"]
        editor.fill("A draft that must survive reload.")
        page.reload(wait_until="domcontentloaded")
        expect(editor).to_have_value("A draft that must survive reload.")
        help_button = page.get_by_role("button", name=re.compile("open the cheat sheet"))
        help_button.click()
        expect(page.get_by_role("dialog", name="Cheat sheet")).to_be_visible()
        page.keyboard.press("Escape")
        expect(help_button).to_be_focused()

        for sentence, lookup, desired in [
            ('I am "a person who writes books".', '"', "an author"),
            ("I feel [fatigué] after work.", "[", "tired"),
            ("I read a [كتاب] every month.", "[", "book"),
            ("The exam was {something very easy}.", "{", "a piece of cake"),
        ]:
            editor.fill(sentence)
            editor.evaluate("(el, pos) => el.setSelectionRange(pos, pos)", sentence.index(lookup) + 2)
            editor.press("Alt+Enter")
            option = page.get_by_role("dialog").get_by_role("button", name=desired, exact=True)
            expect(option).to_be_visible(timeout=95_000)
            option.press("Enter")
            expect(editor).to_have_value(sentence[:sentence.index(lookup)] + desired +
                                         sentence[sentence.index({'"': '"', "[": "]", "{": "}"}[lookup],
                                                                  sentence.index(lookup) + 1) + 1:])
        print("Trigger lookup, Arabic/French, contextual article and keyboard acceptance passed.")

        editor.fill("We will utilize a very big box.")
        expect(page.locator(".u-hard").get_by_text("utilize")).to_be_visible()
        expect(page.locator(".u-better").get_by_text("very big")).to_be_visible()
        page.get_by_role("button", name="Apply all fixes").click()
        expect(editor).to_have_value("We will use a huge box.")
        page.get_by_role("button", name="Undo last edit").click()
        expect(editor).to_have_value("We will utilize a very big box.")

        editor.fill("I has a apple")
        page.get_by_role("button", name="Check draft").click()
        expect(page.locator(".u-err").first).to_be_visible(timeout=45_000)
        page.get_by_role("button", name="Apply all fixes").click()
        expect(editor).to_have_value(re.compile(r"^I have an apple\.?$"))
        print("Readability, lexical highlights, bulk undo, and unpunctuated grammar passed.")

        for original, corrected in [
            ("She went school yesterday.", "She went to school yesterday."),
            ("I saw the the dog.", "I saw the dog."),
        ]:
            editor.fill(original)
            page.get_by_role("button", name="Check draft").click()
            expect(page.get_by_role("heading", name="Quick fixes · 1")).to_be_visible(timeout=45_000)
            page.get_by_role("button", name="Apply all fixes").click()
            expect(editor).to_have_value(corrected)
            page.get_by_role("button", name="Undo last edit").click()
            expect(editor).to_have_value(original)
        print("Real grammar insertions and deletions passed, including undo.")
        hard = "The committee utilized complicated terminology to describe the implementation process."
        editor.fill(hard)
        page.get_by_role("button", name="Simplify sentence").click(timeout=30_000)
        page.get_by_role("button", name="Apply rewrite").click(timeout=45_000)
        assert editor.input_value() != hard
        page.get_by_role("button", name="Undo last edit").click()
        expect(editor).to_have_value(hard)
        print("Real simplification preview, accept, and undo passed.")

        # The App logs a warm-up message only after real WASM inference succeeds.
        deadline = monotonic() + 45
        while monotonic() < deadline and not any("warm-up done" in message for message in logs):
            page.wait_for_timeout(200)
        assert any("warm-up done" in message for message in logs), logs[-16:]
        editor.fill("The results show that the ")
        editor.press("End")
        ghost = page.locator(".ghost[data-source=distilgpt2]")
        expect(ghost).not_to_be_empty(timeout=20_000)
        predicted = ghost.inner_text()
        editor.press("Tab")
        expect(editor).to_have_value("The results show that the " + predicted + " ")
        page.route("**/api/describe", lambda route: route.fulfill(status=503, json={"detail": "Unavailable"}))
        editor.fill('I am "a person who writes books".')
        editor.evaluate("(el) => el.setSelectionRange(11, 11)")
        editor.press("Alt+Enter")
        expect(page.get_by_text("Word lookup unavailable", exact=False)).to_be_visible()
        page.keyboard.press("Escape")
        page.unroute("**/api/describe")
        editor.press("Alt+Enter")
        expect(page.get_by_role("button", name="an author", exact=True)).to_be_visible(timeout=30_000)
        page.keyboard.press("Escape")
        assert not blocked, blocked
        assert not errors, errors
        expect(page.get_by_role("heading", name="Smart Writing")).to_be_visible()
        screenshot = os.environ.get("SMART_WRITING_SCREENSHOT")
        if screenshot:
            page.evaluate("window.scrollTo(0, 0)")
            page.screenshot(path=screenshot)
        markup = '  Dr. Smith paid 3.14 dollars.\n\n🙂 <em>draft</em>  '
        editor.fill(markup)
        expect(editor).to_have_value(markup)
        assert page.locator(".blank-mirror").evaluate(
            "(el) => [...el.children].filter((child) => !child.matches('.ghost')).map((child) => child.textContent).join('')"
        ) == markup
        for width, height in [(1280, 720), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            editor.fill("I feel [fatigué] after work.")
            box = page.locator(".u-trig").bounding_box()
            page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            option = page.get_by_role("button", name="tired", exact=True)
            expect(option).to_be_in_viewport()
            option.click()
            expect(editor).to_have_value("I feel tired after work.")
        if screenshot:
            page.screenshot(path=screenshot.replace(".png", "-mobile.png"), full_page=True)
        print("Offline DistilGPT-2 generated a Tab completion. Responsive layout and zero external requests passed.")
        browser.close()


if __name__ == "__main__":
    main()

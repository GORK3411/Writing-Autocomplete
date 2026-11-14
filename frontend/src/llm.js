// src/llm.js — loads the next-word model once and shares it.
import { env, pipeline } from "@huggingface/transformers";

// DistilGPT-2 (8-bit quantized, roughly 100 MB): small and fast enough for live ghost text.
// It runs on WASM (CPU): for a model this size it's quick and needs no WebGPU
// shader compilation at startup, and it works in every browser.
const MODEL = "Xenova/distilgpt2";

// The setup script prepares this exact model and the matching runtime assets.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = import.meta.env.BASE_URL + "models/";
const wasmRoot = new URL(import.meta.env.BASE_URL + "ort/", location.origin);
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL("ort-wasm-simd-threaded.asyncify.mjs", wasmRoot).href,
  wasm: new URL("ort-wasm-simd-threaded.asyncify.wasm", wasmRoot).href,
};
env.backends.onnx.wasm.numThreads = 2;
env.backends.onnx.wasm.proxy = true;

let generatorPromise = null;

function logProgress(p) {
  if (p.status === "progress") {
    console.log(`[llm] ${p.file}: ${p.progress.toFixed(0)}%`);
  } else if (p.status === "ready") {
    console.log("[llm] model ready");
  }
}

async function load() {
  const t0 = performance.now();
  const gen = await pipeline("text-generation", MODEL, {
    device: "wasm",
    model_file_name: "decoder_model_merged",
    dtype: "q8",
    progress_callback: logProgress,
  });
  console.log(`[llm] loaded in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  // Warm-up: the first call is always slower, so do it here instead of on the user's first keystroke.
  await gen("Hello", { max_new_tokens: 1 });
  console.log(`[llm] warm-up done in ${((performance.now() - t0) / 1000).toFixed(1)}s total`);

  return gen;
}

/**
 * Same contract as suggestNgram(): the ghost text to show after `text`, "" for none.
 * Only one word is returned, so it can replace the n-gram suggestion directly.
 */
export async function suggestWithLlm(gen, text) {
  const midWord = /[A-Za-z']$/.test(text);
  if (!midWord && !/\s$/.test(text)) return "";
  // GPT-2 tokens carry their leading space, so give it the text without the
  // trailing space and let it produce " word" itself.
  const prompt = (midWord ? text : text.trimEnd()).slice(-500);
  if (!prompt) return "";

  const out = await gen(prompt, { max_new_tokens: 3, do_sample: false, return_full_text: false });
  const g = out[0].generated_text;
  const m = midWord ? g.match(/^([A-Za-z']+)/) : g.match(/^ ([A-Za-z']+)/);
  return m ? m[1] : "";
}

export function getGenerator() {
  if (!generatorPromise) {
    generatorPromise = load().catch((err) => {
      generatorPromise = null; // allow retry
      throw err;
    });
  }
  return generatorPromise;
}

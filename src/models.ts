import { ChatOllama } from "@langchain/ollama";

export const ollamaModel = new ChatOllama({
  model: process.env.OLLAMA_MODEL || "qwen3:8b",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

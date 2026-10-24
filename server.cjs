import("./server.js").catch((error) => {
  console.error("Failed to start Reya Ani Extractor:", error);
  process.exit(1);
});

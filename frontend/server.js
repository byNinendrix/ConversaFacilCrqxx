//simple express server to run frontend production build;
const express = require("express");
const path = require("path");
const app = express();
const PORT = Number(process.env.PORT || 3003);

app.use(express.static(path.join(__dirname, "build")));
app.get("/*", function (req, res) {
	res.sendFile(path.join(__dirname, "build", "index.html"));
});
app.listen(PORT, () => {
	console.log(`Frontend static server listening on port ${PORT}`);
}).on("error", (error) => {
	if (error && error.code === "EADDRINUSE") {
		console.error(`Port ${PORT} is already in use.`);
		process.exit(1);
	}
	console.error("Failed to start frontend static server:", error);
	process.exit(1);
});


const express = require("express");
const { exec } = require("child_process");

const app = express();

app.get("/deploy", (req, res) => {
  exec("cd ../user-app && docker build -t myapp . && docker run -d -p 3001:3000 myapp", 
  (err, stdout, stderr) => {
    if (err) {
      return res.send("Deployment failed ❌");
    }
    res.send("Deployment successful 🚀 Visit http://localhost:3001");
  });
});

app.listen(5000, () => {
  console.log("Backend running on port 5000");
});
const express = require("express");
const httpProxy = require("http-proxy");

const app = express();
const PORT = 8000;
const proxy = httpProxy.createProxy();
const BASE_PATH = "https://azimvercel.s3.ap-south-1.amazonaws.com/__outputs";

app.use((req, res) => {
  const hostName = req.hostname;
  const subDomain = hostName.split(".")[0];
  const resolveTo = `${BASE_PATH}/${subDomain}`;
  return proxy.web(req, res, { target: resolveTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") {
    proxyReq.path += "index.html";
  }
});

app.listen(PORT, () => console.log("Reverse proxy running on PORT " + PORT));

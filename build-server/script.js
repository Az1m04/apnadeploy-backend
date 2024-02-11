const { exec } = require("child_process");
const fs = require("fs");
const mime = require("mime-types");
const path = require("path");
const Redis = require("ioredis");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const publisher = new Redis(
  ""
);

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
  console.log("Running script...");

  const outDirPath = path.join(__dirname, "output");

  const process = exec(`cd ${outDirPath} && npm install && npm run build`);
  process.stdout.on("data", function (data) {
    console.log("Data", data.toString());
    publishLog(data.toString());
  });

  process.stdout.on("error", function (data) {
    console.log("Error", data.toString());
    publishLog(`Error:${data.toString()}`);
  });

  process.on("close", async function () {
    console.log("Build Complete");
    publishLog(`Build Complete`);
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    publishLog(`Starting to upload`);
    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log("uploading", filePath);
      publishLog(`uploading ${file}`);

      const command = new PutObjectCommand({
        Bucket: "azimvercel",
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);
      publishLog(`uploaded ${file}`);
      console.log("uploaded", filePath);
    }
    publishLog(`Done`);
    console.log("Done...");
  });
}

init();

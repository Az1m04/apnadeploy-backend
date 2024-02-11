const express = require("express");
const { generateSlug } = require("random-word-slugs");
const {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  StopTaskCommand,
} = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const Redis = require("ioredis");
const cors = require("cors");

const app = express();
const PORT = 9000;
const SOCKET_PORT = 9001;
app.use(express.json());
app.use(cors());

const subscriber = new Redis(
  "rediss://default:AVNS_Y2-hq77-Ya5c5pIbeQi@redis-34c7486f-azimcool06-d4f4.a.aivencloud.com:14449"
);

const io = new Server({ cors: "*" });

var config = {
  CLUSTER: "arn:aws:ecs:ap-south-1:321924218941:cluster/build-cluster",
  TASK: "arn:aws:ecs:ap-south-1:321924218941:task-definition/builder-task",
  taskId: "",
};

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
  socket.on("taskEnd", async () => {
    // Stop the task
    const stopTaskCommand = new StopTaskCommand({
      cluster: config.CLUSTER,
      task: config.taskId,
    });

    await ecsClient.send(stopTaskCommand);
    console.log(`Task ${config.taskId} stopped successfully`);
  });
});

io.listen(SOCKET_PORT, () =>
  console.log("Socket connected to Port: " + SOCKET_PORT)
);

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: "AKIAUV5BNYA6ZAOAEP75",
    secretAccessKey: "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",
  },
});

app.post("/deploy", async (req, res) => {
  const { gitUrl, slug } = req.body;
  const projectSlug = slug ? slug : generateSlug();

  try {
    const command = new RunTaskCommand({
      cluster: config.CLUSTER,
      taskDefinition: config.TASK,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: [
            "subnet-01085500a37729c9e",
            "subnet-03f82afcf4d07fb66",
            "subnet-08bcfe8398935ac21",
          ],
          securityGroups: ["sg-002dbb2f792fee9e2"],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "build-image",
            environment: [
              {
                name: "GIT_REPOSITORY_URL",
                value: gitUrl,
              },
              {
                name: "PROJECT_ID",
                value: projectSlug,
              },
            ],
          },
        ],
      },
    });

    const runTaskResponse = await ecsClient.send(command);
    const taskId = runTaskResponse.tasks[0].taskArn.split("/").pop();
    config = { ...config, taskId: taskId };

    console.log(`Task ${taskId} started successfully`);


    return res.json({
      status: "completed",
      data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
    });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
});

async function initRedisSubscribe() {
  console.log("Subscribed to logs....");
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

initRedisSubscribe();

app.listen(PORT, () => console.log("Node server running on PORT " + PORT));

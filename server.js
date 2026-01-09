const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const query = require("./db/query");
const jwt = require("jsonwebtoken");
const userAuth = require("./auth/user_auth");
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 8080;
const crypto = require("crypto");
const multer = require("multer");
const imagga = require("./service/img-detect");
const imgbb = require("./service/host-img");
const mailer = require("./service/mailer");

const app = express();

const secretKey = process.env.SECRET_KEY;

// Response with error
function responseError(res, status_code = 500, msg = "Internal Server Error") {
  res.status(status_code).send(msg);
}

// Upload config
const upload = multer({
  dest: "./tmp-uploads/",
});

// Set EJS as template engine
app.set("view engine", "ejs");

// Serve static files from views directory
app.use(express.static(path.join(__dirname, "views")));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Use cookie-parser middleware
app.use(cookieParser());

// Routes
app.get(["/", "/index.html", "/index"], (req, res) => {
  let isLoggedIn = false;
  let username = "";

  if (userAuth.validCookie(req)) {
    if (userAuth.verifyToken(req.cookies.token)) {
      isLoggedIn = true;
      try {
        const decoded = jwt.decode(req.cookies.token);
        username = decoded["username"] || "{Username Not Found}";
      } catch (err) {
        username = `Username ${err}`;
      }
    }
  }

  res.render("index", { isLoggedIn, username });
});

app.get(["/guide", "/guide.html"], (req, res) => {
  res.render("user-guide");
});

app.get(["/car", "/car.html"], userAuth.requireAuthentication, (req, res) => {
  // res.sendFile(path.join(__dirname, 'car.html'));
  res.render("car");
});

app.post(
  "/host-image-b64",
  userAuth.requireAuthentication,
  async (req, res) => {
    try {
      const { image } = req.body; // Get the image base64 data

      if (!image) {
        responseError(res, 400, "Image data NULL");
        return;
      }

      // 1. Upload to ImgBB
      const imgBBResponse = await imgbb.hostImageBase64(image);

      if (typeof imgBBResponse === "string") {
        if (imgBBResponse.includes("Error")) {
          responseError(res, 500, imgBBResponse);
          return;
        }
        return;
      }

      console.log("imgbb response:", imgBBResponse);
      console.log("imgbb data", imgBBResponse.data);

      if (imgBBResponse.data && imgBBResponse.data.url) {
        console.log("Parsing ImgBB data");
        const publicURL = imgBBResponse.data.url;
        const decoded = jwt.verify(req.cookies.token, secretKey);
        const userId = decoded.sub;
        console.log("public url:", publicURL);
        console.log("userId:", userId);
        const response = await query.addUserImage(
          userId,
          publicURL,
          `image-name.jpeg`,
        );
        console.log("response:", response);
        if (typeof response === "string") {
          if (response.includes("Error")) {
            responseError(res, 500, response);
            return;
          }
        }
        console.log("Successfully hosting image to ImgBB");
        res.send(imgBBResponse.data);
      } else {
        console.log("Fail to host image to imgBB");
        responseError(res, 500, "Fail ImgBB Request");
        return;
      }
    } catch (error) {
      console.log("Error: uploading failed @@", error);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

app.post(
  "/host-image",
  userAuth.requireAuthentication,
  upload.single("image"),
  async (req, res) => {
    const filePath = req.file.path;

    if (!filePath) {
      responseError(res, 400, "File path to ImgBB empty");
      return;
    }

    console.log("File path to ImgBB is", filePath);

    var imgBBResponse = await imgbb.hostImage(filePath);
    if (typeof imgBBResponse === "string") {
      if (imgBBResponse.includes("Error")) {
        responseError(res, 500, imgBBResponse);
        return;
      }
      return;
    }
    // console.log("Img BB Response:");
    if (
      imgBBResponse.data &&
      imgBBResponse.data.data &&
      imgBBResponse.data.data.url
    ) {
      res.send(imgBBResponse.data.data);
    } else {
      responseError(res, 500, "Fail ImgBB Request");
    }
  },
);

app.post(
  "/analyze-image",
  userAuth.requireAuthentication,
  upload.single("image"),
  async (req, res) => {
    let imageInput = null;

    // 1. CHECK: Is it a Base64 string? (Sent as JSON body)
    if (req.body && req.body.image) {
      const type = req.body.image.startsWith("http") ? "URL" : "Base64";
      console.log(`Received ${type} Image for analysis`);
      imageInput = req.body.image;
    }
    // 2. CHECK: Is it a File Upload? (Sent as Multipart/Multer)
    else if (req.file && req.file.path) {
      console.log("Received File Path for analysis:", req.file.path);
      imageInput = req.file.path;
    }

    // 3. Validation
    if (!imageInput) {
      return responseError(
        res,
        400,
        "No image data received (checked body and file)",
      );
    }

    // 4. Call Imagga
    // (Assuming you updated requestImagga to handle Base64 as shown in previous steps)
    try {
      console.log("image input:", imageInput);
      var imaggaResp = await imagga.requestImagga(imageInput);

      console.log("Imagga Response:", imaggaResp);

      if (typeof imaggaResp === "string" && imaggaResp.includes("Error")) {
        return responseError(res, 500, imaggaResp);
      }

      res.send(imaggaResp);
    } catch (err) {
      console.error(err);
      responseError(res, 500, "Internal Server Error during Analysis");
    }
  },
);

app.get("/get-images", userAuth.requireAuthentication, async (req, res) => {
  const decoded = jwt.verify(req.cookies.token, secretKey);
  console.log("User id when requesting image:", decoded);
  const userId = decoded.sub;
  console.log("user id:", userId);
  if (!userId) {
    responseError(res, 400, "Invalid user id");
    return;
  }

  const images = await query.getUserImages(userId);
  if (typeof images === "string") {
    if (images.includes("Error")) {
      responseError(res);
      return;
    }
  }

  res.send(images);
});

app.get(
  ["/login", "/login.html"],
  userAuth.requireNoAuthentication,
  (req, res) => {
    const msg = req.query.msg || "";
    res.render("login", { msg });
  },
);

app.post("/login", userAuth.requireNoAuthentication, async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
    responseError(res, 400, "Username/Password is empty");
    return;
  }

  const user = await query.getUserByUsername(username);

  if (!user) {
    res.render("login", { msg: "User does not exist!" });
    return;
  }

  const passInputHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(passInputHash),
      Buffer.from(user["password"]),
    )
  ) {
    res.render("login", { msg: "Wrong username or password" });
    return;
  }

  // Successful login
  const payload = {
    sub: user["id"],
    username: user["username"],
    email: user["email"],
  };
  res.cookie("token", userAuth.generateToken(payload), { httpOnly: true });
  // Mail notification
  await mailer.sendMail({
    to: user.email,
    subject: "Car Control Login Alert",
    text: `Hello ${user.username},

  Your account has logged in successfully.

  Time: ${new Date().toLocaleString()}

  If this was not you, please secure your account immediately.`,
  });

  res.redirect("/");
});

app.get(
  ["/signup", "/signup.html"],
  userAuth.requireNoAuthentication,
  (req, res) => {
    const msg = req.query.msg || "";
    res.render("signup", { msg });
  },
);

app.post("/signup", userAuth.requireNoAuthentication, async (req, res) => {
  const email = req.body.email;
  const username = req.body.username;
  const password = req.body.password;

  if (!email || !username || !password) {
    responseError(res, 400, "Credentials are empty");
    return;
  }

  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!pattern.test(email)) {
    res.render("signup", { msg: "Email format uncorrect" });
    return;
  }

  // TODO: Extra email and username check

  var user = await query.getUserByUsername(username);

  if (user) {
    res.render("signup", { msg: "Username already exist!" });
    return;
  }

  user = await query.getUserByUsername(email);

  if (user) {
    res.render("signup", { msg: "Email already exist!" });
    return;
  }

  const passInputHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const resp = await query.addUser(email, username, passInputHash);

  if (resp.includes("Cannot")) {
    res.render("signup", { msg: "Error creating new account" });
    return;
  }

  // Successfully creating new account
  res.redirect("/login");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// Create HTTP server from Express app
const server = http.createServer(app);

function getUserFromWsRequest(request) {
  try {
    const cookies = request.headers.cookie;
    if (!cookies) return null;

    const token = cookies
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("token="))
      ?.split("=")[1];

    if (!token) return null;
    return jwt.decode(token);
  } catch {
    return null;
  }
}

// ===== WS /car: controlling car =====
const wssCar = new WebSocket.Server({ noServer: true });
let carSocket = null;

wssCar.on("connection", (ws) => {
  console.log("WS client connected to /car");

  ws.on("message", (msg) => {
    const text = msg.toString();
    console.log("WS /car message:", text);

    if (text === "type:car") {
      carSocket = ws;
      console.log("Registered car client");
      return;
    }

    // client điều khiển -> forward cho car
    if (ws !== carSocket) {
      if (carSocket && carSocket.readyState === WebSocket.OPEN) {
        carSocket.send(text);
      }
    }
  });

  ws.on("close", async () => {
    console.log("WS /car client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WS /car error:", err);
  });
});

// ===== WS /cam: stream video from ESP32-CAM =====
const wssCam = new WebSocket.Server({ noServer: true });

let camSocket = null; // ESP32‑CAM
const viewers = new Set(); // các browser xem video

wssCam.on("connection", (ws, request) => {
  console.log("WS client connected to /cam");
  ws.isAlive = true; // For ping/pong
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      // ESP32-CAM gửi "type:cam" để đăng ký
      const text = data.toString();
      console.log("WS /cam text:", text);
      if (text === "type:cam") {
        camSocket = ws;
        console.log("Registered cam client");
      }
      return;
    }

    // Binary: giả sử là JPEG frame -> broadcast tới viewers
    for (const client of viewers) {
      if (client.readyState !== WebSocket.OPEN) continue;

      // Bảo vệ realtime: nếu client backlog lớn, bỏ frame này để tránh tích lũy độ trễ [web:86]
      if (client.bufferedAmount > 512 * 1024) continue;

      client.send(data, { binary: true });
    }
  });

  ws.on("close", () => {
    console.log("WS /cam client disconnected");
    if (ws === camSocket) {
      camSocket = null;
      console.log("Camera disconnected");
    }
    viewers.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("WS /cam error:", err);
  });

  // Mặc định: nếu chưa gửi "type:cam", coi ws này là viewer
  viewers.add(ws);
});

// ============== WS /mic: ESP32-S3 mic -> broadcast lên web ==============
const wssMic = new WebSocket.Server({ noServer: true });
let micSocket = null; // ESP32-S3 mic sender
const micListeners = new Set(); // các browser nghe mic

wssMic.on("connection", (ws) => {
  console.log("WS client connected to /mic");

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const text = data.toString();
      if (text === "type:mic") {
        micSocket = ws;
        console.log("Registered mic client");
      }
      return;
    }

    // Binary PCM16 -> broadcast tới listeners (browser)
    // (ESP gửi lên, browser nhận để phát WebAudio)
    for (const client of micListeners) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.bufferedAmount > 512 * 1024) continue;
      client.send(data, { binary: true });
    }
  });

  ws.on("close", () => {
    console.log("WS /mic client disconnected");
    if (ws === micSocket) {
      micSocket = null;
      console.log("Mic source disconnected");
    }
    micListeners.delete(ws);
  });

  ws.on("error", (err) => console.error("WS /mic error:", err));

  // Nếu không phải mic source (chưa gửi type:mic) thì coi như listener
  micListeners.add(ws);
});

// ============== WS /speaker: browser -> ESP32-S3 speaker ==============
const wssSpeaker = new WebSocket.Server({ noServer: true });
let speakerSocket = null; // ESP32-S3 speaker receiver

wssSpeaker.on("connection", (ws) => {
  console.log("WS client connected to /speaker");

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const text = data.toString();
      if (text === "type:speaker") {
        speakerSocket = ws;
        console.log("Registered speaker client");
      }
      return;
    }

    // Binary PCM16 từ browser -> forward cho ESP32-S3 phát loa
    if (ws !== speakerSocket) {
      if (speakerSocket && speakerSocket.readyState === WebSocket.OPEN) {
        // chống backlog cho ESP32
        if (speakerSocket.bufferedAmount < 256 * 1024) {
          speakerSocket.send(data, { binary: true });
        }
      }
    }
  });

  ws.on("close", () => {
    console.log("WS /speaker client disconnected");
    if (ws === speakerSocket) {
      speakerSocket = null;
      console.log("Speaker device disconnected");
    }
  });

  ws.on("error", (err) => console.error("WS /speaker error:", err));
});

// ============== Upgrade routing cho nhiều path ==============
// Pattern này đúng theo ví dụ "multiple servers sharing a single HTTP server" của ws
server.on("upgrade", (request, socket, head) => {
  const { url } = request;

  if (url === "/car") {
    wssCar.handleUpgrade(request, socket, head, (ws) =>
      wssCar.emit("connection", ws, request),
    );
  } else if (url === "/cam") {
    wssCam.handleUpgrade(request, socket, head, (ws) =>
      wssCam.emit("connection", ws, request),
    );
  } else if (url === "/mic") {
    wssMic.handleUpgrade(request, socket, head, (ws) =>
      wssMic.emit("connection", ws, request),
    );
  } else if (url === "/speaker") {
    wssSpeaker.handleUpgrade(request, socket, head, (ws) =>
      wssSpeaker.emit("connection", ws, request),
    );
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`HTTP+WS server listening on port ${PORT}`);
});

// ... giữ nguyên các require và PORT

// const MUSIC_DIR = path.join(__dirname, 'music');

// function contentTypeByExt(filePath) {
//   const ext = path.extname(filePath).toLowerCase();
//   if (ext === '.mp3') return 'audio/mpeg';
//   if (ext === '.wav') return 'audio/wav';
//   if (ext === '.aac') return 'audio/aac';
//   return 'application/octet-stream';
// }

// const server = http.createServer((req, res) => {
//   // 1) Trang web như cũ
//   if (req.url === '/' || req.url === '/index.html') {
//     const filePath = path.join(__dirname, 'index.html');
//     fs.readFile(filePath, (err, data) => {
//       if (err) {
//         res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
//         res.end('Internal Server Error');
//         return;
//       }
//       res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
//       res.end(data);
//     });
//     return;
//   }

//   // 2) Endpoint phát nhạc: /music/<tenfile>
//   if (req.url.startsWith('/music/')) {
//     const safeName = path.basename(req.url);           // chặn ../
//     const filePath = path.join(MUSIC_DIR, safeName);

//     if (!fs.existsSync(filePath)) {
//       res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
//       res.end('Music not found');
//       return;
//     }

//     const stat = fs.statSync(filePath);
//     const range = req.headers.range; // ví dụ "bytes=0-"

//     const ct = contentTypeByExt(filePath);

//     if (!range) {
//       res.writeHead(200, {
//         'Content-Type': ct,
//         'Content-Length': stat.size,
//         'Accept-Ranges': 'bytes',
//         'Cache-Control': 'no-cache',
//       });
//       fs.createReadStream(filePath).pipe(res);
//       return;
//     }

//     // Range support
//     const m = range.match(/bytes=(\d+)-(\d*)/);
//     if (!m) {
//       res.writeHead(416);
//       res.end();
//       return;
//     }

//     const start = parseInt(m[1], 10);
//     const end = m[2] ? parseInt(m[2], 10) : (stat.size - 1);
//     if (start >= stat.size || end >= stat.size) {
//       res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
//       res.end();
//       return;
//     }

//     const chunkSize = (end - start) + 1;
//     res.writeHead(206, {
//       'Content-Type': ct,
//       'Content-Length': chunkSize,
//       'Content-Range': `bytes ${start}-${end}/${stat.size}`,
//       'Accept-Ranges': 'bytes',
//       'Cache-Control': 'no-cache',
//     });

//     fs.createReadStream(filePath, { start, end }).pipe(res);
//     return;
//   }

//   // 404 như cũ
//   res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
//   res.end('Not found');
// });

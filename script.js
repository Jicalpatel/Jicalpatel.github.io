const VISIT_KEY = "portfolio_total_visits";
const CLICK_KEY = "portfolio_total_clicks";
const SESSION_KEY = "portfolio_session_initialized";
const VISIT_BASE = 30;
const DATA_VERSION = Date.now();
const COUNTER_CONFIG_PATH = "data/counter-config.json";

async function loadJson(path) {
  const joiner = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${joiner}v=${DATA_VERSION}`, {
    cache: "no-store",
  });
  return response.json();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderCounts() {
  const visits = Number(localStorage.getItem(VISIT_KEY) || String(VISIT_BASE));
  const clicks = Number(localStorage.getItem(CLICK_KEY) || "0");
  animateCount("visit-count", visits);
  animateCount("click-count", clicks);
}

function renderCloudCounts(visits, clicks) {
  animateCount("visit-count", Number(visits) || 0);
  animateCount("click-count", Number(clicks) || 0);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;

  const safeTarget = Math.max(0, Number(target) || 0);
  const isFirstAnimation = el.dataset.animated !== "true";
  const fallbackStart = Math.max(
    0,
    safeTarget - Math.max(20, Math.floor(safeTarget * 0.7)),
  );
  const prev = Number(
    el.dataset.value || String(isFirstAnimation ? fallbackStart : safeTarget),
  );

  if (prev === safeTarget) {
    el.textContent = String(safeTarget).padStart(4, "0");
    return;
  }

  const duration = isFirstAnimation ? 1500 : 700;
  const startTime = performance.now();
  const start = Math.max(0, prev);

  const frame = (time) => {
    const progress = Math.min(1, (time - startTime) / duration);
    const eased = progress < 0.6
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const value = Math.round(start + (safeTarget - start) * eased);
    el.textContent = String(value).padStart(4, "0");

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.dataset.value = String(safeTarget);
      el.dataset.animated = "true";
    }
  };

  requestAnimationFrame(frame);
}

function setupLocalCounters() {
  if (!localStorage.getItem(VISIT_KEY)) {
    localStorage.setItem(VISIT_KEY, String(VISIT_BASE));
  }

  if (!localStorage.getItem(CLICK_KEY)) {
    localStorage.setItem(CLICK_KEY, "0");
  }

  if (!sessionStorage.getItem(SESSION_KEY)) {
    const nextVisits = Number(localStorage.getItem(VISIT_KEY) || String(VISIT_BASE)) + 1;
    localStorage.setItem(VISIT_KEY, String(nextVisits));
    sessionStorage.setItem(SESSION_KEY, "true");
  }

  const clicks = Number(localStorage.getItem(CLICK_KEY) || "0");
  if (!Number.isFinite(clicks)) localStorage.setItem(CLICK_KEY, "0");

  document.addEventListener("click", () => {
    const nextClicks = Number(localStorage.getItem(CLICK_KEY) || "0") + 1;
    localStorage.setItem(CLICK_KEY, String(nextClicks));
    renderCounts();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === VISIT_KEY || event.key === CLICK_KEY) {
      renderCounts();
    }
  });

  setInterval(renderCounts, 250);

  renderCounts();
}

function hasFirebaseConfig(config) {
  const firebase = config?.firebase || {};
  return Boolean(
    config?.enabled
      && firebase.apiKey
      && firebase.projectId
      && firebase.databaseURL
      && !firebase.apiKey.includes("PASTE_")
      && !firebase.databaseURL.includes("PASTE_"),
  );
}

async function setupFirebaseCounters(config) {
  const [
    { initializeApp },
    { getDatabase, onValue, ref, runTransaction },
  ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
  ]);

  const app = initializeApp(config.firebase);
  const database = getDatabase(app);
  const visitsRef = ref(database, "portfolioStats/visits");
  const clicksRef = ref(database, "portfolioStats/clicks");

  let latestVisits = 0;
  let latestClicks = 0;

  onValue(visitsRef, (snapshot) => {
    latestVisits = Number(snapshot.val()) || 0;
    renderCloudCounts(latestVisits, latestClicks);
  });

  onValue(clicksRef, (snapshot) => {
    latestClicks = Number(snapshot.val()) || 0;
    renderCloudCounts(latestVisits, latestClicks);
  });

  if (!sessionStorage.getItem(`${SESSION_KEY}_cloud`)) {
    await runTransaction(visitsRef, (current) => (Number(current) || 0) + 1);
    sessionStorage.setItem(`${SESSION_KEY}_cloud`, "true");
  }

  document.addEventListener("click", () => {
    runTransaction(clicksRef, (current) => (Number(current) || 0) + 1);
  });
}

async function setupCounters() {
  try {
    const config = await loadJson(COUNTER_CONFIG_PATH);
    if (hasFirebaseConfig(config)) {
      await setupFirebaseCounters(config);
      return;
    }
  } catch (error) {
    console.warn("Cloud counters are not configured. Using local counters.", error);
  }

  setupLocalCounters();
}

function setupSmoothScroll() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute("href");
    if (!targetId || targetId === "#") return;

    const target = document.querySelector(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setupScrollProgress() {
  const progress = document.getElementById("scroll-progress");
  if (!progress) return;

  const update = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = pageHeight > 0 ? (scrollTop / pageHeight) * 100 : 0;
    progress.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

function setupParallaxGlow() {
  const update = () => {
    const y = window.scrollY || 0;
    const shift = Math.max(-22, Math.min(22, y * 0.03));
    document.documentElement.style.setProperty("--glow-shift", `${shift}px`);
  };

  window.addEventListener("scroll", update, { passive: true });
  update();
}

function setupRevealAnimations() {
  const targets = document.querySelectorAll(
    ".section, .footer-top, .footer-bottom, .project, .item, .contact-grid p, .word-reveal",
  );
  targets.forEach((el) => el.classList.add("reveal"));

  const update = () => {
    const vh = window.innerHeight;
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const visible = rect.top < vh * 0.86 && rect.bottom > vh * 0.14;
      el.classList.toggle("in-view", visible);
    });
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("pageshow", update);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });
  update();
}

function setupWordByWordAnimations() {
  const elements = document.querySelectorAll('[data-animate="words"]');

  elements.forEach((el) => {
    if (el.dataset.wordsPrepared === "true") return;

    const raw = el.textContent || "";
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;

    el.classList.add("word-reveal");
    el.textContent = "";

    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "word";
      span.style.transitionDelay = `${Math.min(index * 70, 1200)}ms`;
      span.textContent = word;
      el.appendChild(span);
      if (index < words.length - 1) el.appendChild(document.createTextNode(" "));
    });

    el.dataset.wordsPrepared = "true";
  });
}

function setupWordObserver() {
  const targets = document.querySelectorAll(".word-reveal");
  if (!targets.length) return;

  const update = () => {
    const vh = window.innerHeight;
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const visible = rect.top < vh * 0.9 && rect.bottom > vh * 0.1;
      el.classList.toggle("word-in", visible);
    });
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("pageshow", update);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });
  update();
}

function setupHeaderBehavior() {
  const header = document.querySelector(".site-header");
  const logo = document.querySelector(".logo");
  const compactJp = document.getElementById("compact-jp");
  if (!header || !logo || !compactJp) return;

  const updateHeaderState = () => {
    const compact = window.scrollY > 20;
    document.body.classList.toggle("header-compact", compact);
    if (!compact) {
      document.body.classList.remove("menu-open");
    }
  };

  logo.addEventListener("click", (event) => {
    if (!document.body.classList.contains("header-compact")) return;
    event.preventDefault();
    document.body.classList.toggle("menu-open");
  });

  document.querySelectorAll(".site-header nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("menu-open");
    });
  });

  window.addEventListener("scroll", updateHeaderState, { passive: true });
  updateHeaderState();
}

function setupChatbot() {
  const shell = document.getElementById("chatbot-shell");
  const form = document.getElementById("chatbot-form");
  const input = document.getElementById("chatbot-input");
  const messages = document.getElementById("chatbot-messages");
  const footerCta = document.getElementById("footer-cta");
  if (!shell || !form || !input || !messages) return;

  const knowledge = [
    {
      intent: "projects",
      weight: 1.1,
      keywords: ["project", "projects", "work", "built", "build", "made", "created", "developed", "case study", "showcase", "portfolio", "application", "apps", "system"],
      response: "Jical's project portfolio includes MedCare, Singing Voice Synthesis, Distributed HIP DNN Pipeline, Hybrid Bucket-Radix Sorting, Co-Purchasing Recommendation, Uber Clone, and Skin Disease Identification. These projects cover healthcare AI, audio ML, distributed GPU systems, data mining, blockchain, mobile UI, and web development.",
    },
    {
      intent: "experience",
      weight: 1.1,
      keywords: ["experience", "job", "jobs", "work history", "worked", "employment", "role", "roles", "professional", "progressive", "xlab", "office", "assistant", "tops", "internship", "company", "companies"],
      response: "Jical has experience as a Software Developer with xLab / Progressive Insurance, Graduate Assistant at Case Western Reserve University, Android Developer at TOPS Technology, and Office Assistant at Siegal Lifelong Learning. His experience mixes Agile software delivery, Android development, teaching/debugging support, and customer-facing technology support.",
    },
    {
      intent: "education",
      weight: 1,
      keywords: ["education", "study", "studies", "school", "college", "university", "degree", "master", "masters", "bachelor", "bachelors", "cwru", "case western", "ldrp", "san francisco", "sfsu", "academic", "academics"],
      response: "Jical graduated with a Master's in Computer Science from Case Western Reserve University, part of the New Ivy group of leading research universities. He also completed Data Analysis with Computer Application at San Francisco State University and earned a Bachelor of Engineering in Computer Engineering from LDRP-ITR.",
    },
    {
      intent: "skills",
      weight: 1.1,
      keywords: ["skill", "skills", "stack", "technology", "technologies", "programming", "tools", "language", "languages", "java", "python", "kotlin", "sql", "firebase", "android", "next", "django", "database", "frontend", "backend", "full stack", "machine learning", "ml"],
      response: "Jical's skills include Java, Kotlin, C, C++, Python, SQL, data structures and algorithms, Android Studio, Firebase, REST APIs, MySQL, SQLite, Cloud Firestore, Git, debugging, Tableau, UI/UX design, performance optimization, Next.js, Django, and machine learning.",
    },
    {
      intent: "resume",
      weight: 1,
      keywords: ["resume", "cv", "download", "pdf", "profile", "document"],
      response: "You can open Jical's resume from the Resume link in the footer. It includes education, experience, projects, research, certifications, technical skills, and soft skills.",
    },
    {
      intent: "contact",
      weight: 1,
      keywords: ["contact", "email", "linkedin", "phone", "connect", "reach", "message", "call", "get in touch"],
      response: "You can contact Jical by email at jicalharish15102002@gmail.com or through LinkedIn at linkedin.com/in/jical-patel. For his phone number, please email first.",
    },
    {
      intent: "medcare",
      weight: 1.25,
      keywords: ["medcare", "healthcare", "health", "disease prediction", "prediction", "django", "medical", "diagnosis"],
      response: "MedCare is a healthcare ML project where Jical developed disease prediction machine learning models and integrated them with a Django web interface for accessible decision support.",
    },
    {
      intent: "skin disease",
      weight: 1.25,
      keywords: ["skin", "disease", "tensorflow", "keras", "openvino", "75", "accuracy", "diagnosis", "mobile friendly"],
      response: "Skin Disease Identification used TensorFlow, Keras, and OpenVINO. The resume highlights a 75% accuracy AI model and a mobile-friendly UI for diagnosis access.",
    },
    {
      intent: "uber clone",
      weight: 1.25,
      keywords: ["uber", "ride", "rides", "ride hailing", "blockchain", "ethereum", "smart contract", "smart contracts", "crypto", "gps", "fare"],
      response: "The Uber Clone project is a blockchain-based ride-hailing system using smart contracts, Ethereum Rinkeby Testnet crypto payments, real-time GPS tracking, and automated fare calculations.",
    },
    {
      intent: "singing voice",
      weight: 1.25,
      keywords: ["singing", "voice", "audio", "song", "music", "hifigan", "fastspeech", "gradio", "lyrics", "synthesis", "synthesizer"],
      response: "Singing Voice Synthesis converts lyrics into sung audio using FastSpeech2 Conformer, HiFi-GAN, transfer learning, the Children's Song Dataset, and a Gradio interface.",
    },
    {
      intent: "hip",
      weight: 1.25,
      keywords: ["hip", "gpu", "mpi", "distributed", "dnn", "kernel", "kernels", "parallel", "amd", "throughput", "latency"],
      response: "The Distributed HIP DNN Pipeline connects MPI4Py data producers with AMD HIP GPU consumers. It focuses on distributed training architecture, GPU kernels, throughput, latency, and benchmarking.",
    },
    {
      intent: "research",
      weight: 1,
      keywords: ["research", "paper", "publication", "published", "battery", "thermal", "analysis", "ijrpr"],
      response: "Jical published research on Battery Efficiency through Thermal Analysis, focused on optimizing battery efficiency using thermal analysis techniques.",
    },
  ];

  const projectCatalog = [
    {
      name: "MedCare",
      aliases: ["medcare", "medical", "healthcare", "disease prediction", "django"],
      category: ["machine learning", "healthcare", "web", "backend"],
      summary: "MedCare combines disease prediction machine learning models with a Django web interface, turning ML output into a usable healthcare-focused web app.",
    },
    {
      name: "Singing Voice Synthesis",
      aliases: ["singing", "voice", "audio", "music", "hifigan", "fastspeech", "gradio", "lyrics"],
      category: ["machine learning", "audio", "generative ai"],
      summary: "Singing Voice Synthesis converts lyrics into sung audio using FastSpeech2 Conformer, HiFi-GAN, transfer learning, CSD dataset analysis, and Gradio.",
    },
    {
      name: "Distributed HIP DNN Pipeline",
      aliases: ["hip", "gpu", "mpi", "distributed", "dnn", "kernel", "amd", "parallel"],
      category: ["systems", "gpu", "distributed", "performance"],
      summary: "Distributed HIP DNN Pipeline connects MPI4Py data producers with AMD HIP GPU consumers, focusing on distributed training architecture and performance metrics.",
    },
    {
      name: "Hybrid Bucket-Radix Sorting Study",
      aliases: ["sorting", "radix", "bucket", "algorithm", "gpu cpu", "benchmark"],
      category: ["algorithms", "gpu", "performance"],
      summary: "Hybrid Bucket-Radix Sorting compares non-comparison sorting strategies across GPU and CPU architectures with attention to performance and memory behavior.",
    },
    {
      name: "Co-Purchasing Analysis and Recommendation",
      aliases: ["co-purchasing", "recommendation", "recommendations", "market basket", "data mining", "analytics"],
      category: ["data", "recommendation", "analytics"],
      summary: "Co-Purchasing Analysis studies product relationships and co-purchase behavior to surface recommendation and product-discovery insights.",
    },
    {
      name: "Uber Clone",
      aliases: ["uber", "ride", "blockchain", "ethereum", "smart contract", "gps", "fare"],
      category: ["mobile", "blockchain", "product"],
      summary: "Uber Clone is a blockchain-based ride-hailing system using smart contracts, Ethereum Rinkeby Testnet payments, GPS tracking, and automated fare calculation.",
    },
    {
      name: "Skin Disease Identification",
      aliases: ["skin", "disease", "tensorflow", "keras", "openvino", "75", "diagnosis"],
      category: ["machine learning", "healthcare", "mobile"],
      summary: "Skin Disease Identification uses TensorFlow, Keras, and OpenVINO with a mobile-friendly UI; the resume highlights 75% model accuracy.",
    },
  ];

  const experienceCatalog = [
    "Software Developer, xLab / Progressive Insurance: Agile application delivery using GitHub workflows, iOS, Next.js, MongoDB, and Java.",
    "Graduate Assistant, CWRU: computer security support, coding/debugging help, grading, exams, and feedback.",
    "Android Developer, TOPS Technology: Android apps with Java, Kotlin, Firebase, XML, Jetpack Compose, and REST APIs.",
    "Office Assistant, Siegal Lifelong Learning: front-line technology support, client inquiries, records, and special projects.",
  ];

  const synonymMap = {
    made: "built",
    make: "built",
    created: "built",
    create: "built",
    developed: "built",
    develop: "built",
    app: "application",
    apps: "application",
    technologies: "technology",
    tech: "technology",
    university: "school",
    college: "school",
    studies: "education",
    studying: "education",
    job: "experience",
    jobs: "experience",
    worked: "experience",
    career: "experience",
    reach: "contact",
    mail: "email",
    ai: "machine learning",
    ml: "machine learning",
    frontend: "front end",
    backend: "back end",
    recruiter: "recruiter",
  };

  const stopWords = new Set(["a", "an", "the", "is", "are", "was", "were", "to", "for", "of", "and", "or", "in", "on", "with", "about", "me", "you", "he", "his", "him", "jical", "patel", "tell", "show", "explain", "please", "what", "which", "can", "does", "do"]);

  let lastIntent = "overview";
  let lastProject = null;
  const replyRotation = {};

  const rotateReply = (key, replies) => {
    const index = replyRotation[key] || 0;
    replyRotation[key] = index + 1;
    return replies[index % replies.length];
  };

  const normalize = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokenize = (text) => normalize(text)
    .split(" ")
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .map((word) => synonymMap[word] || word);

  const levenshtein = (a, b) => {
    if (Math.abs(a.length - b.length) > 3) return 99;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  };

  const tokenClose = (a, b) => {
    if (a === b) return true;
    if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
    return a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1;
  };

  const phraseScore = (clean, phrase, tokens) => {
    const normalizedPhrase = normalize(phrase);
    if (clean.includes(normalizedPhrase)) return normalizedPhrase.includes(" ") ? 4 : 2.2;
    const phraseTokens = tokenize(normalizedPhrase);
    if (!phraseTokens.length) return 0;
    const score = phraseTokens.reduce((total, phraseToken) => {
      const matched = tokens.some((token) => tokenClose(token, phraseToken));
      return total + (matched ? 1 : 0);
    }, 0);
    return score / Math.max(1, phraseTokens.length);
  };

  const scoreItem = (clean, tokens, keywords, weight = 1) => keywords
    .reduce((total, keyword) => total + phraseScore(clean, keyword, tokens), 0) * weight;

  const findProject = (clean, tokens) => projectCatalog
    .map((project) => ({
      ...project,
      score: scoreItem(clean, tokens, [...project.aliases, ...project.category, project.name], 1.25),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const projectsByCategory = (category) => projectCatalog
    .filter((project) => project.category.some((item) => item.includes(category) || category.includes(item)));

  const listProjects = (items) => items.map((project) => `- ${project.name}: ${project.summary}`).join("\n");

  const wants = (clean, words) => words.some((word) => clean.includes(word));

  const getRecruiterPitch = () => rotateReply("hire", [
    [
      "Jical is worth hiring because he already shows the mix companies want in an early-career software engineer: practical building, fast learning, and the ability to connect technical work to real users.",
      "Why he stands out:",
      "- Real software delivery: xLab / Progressive Insurance Agile application work with GitHub workflows, iOS, Next.js, MongoDB, and Java.",
      "- Mobile strength: Android development with Java, Kotlin, Firebase, REST APIs, XML, and Jetpack Compose.",
      "- Applied AI/product mindset: MedCare, Skin Disease Identification, and Singing Voice Synthesis show ML used for practical outcomes.",
      "- Systems depth: Distributed HIP DNN Pipeline and Hybrid Bucket-Radix Sorting show GPU, performance, and algorithmic thinking.",
      "Best fit: software engineering roles where a team needs someone adaptable, hands-on, detail-oriented, and comfortable learning across mobile, web, data, and AI.",
    ].join("\n"),
    [
      "I would position Jical as a strong software engineering candidate because he is not limited to one lane.",
      "He brings Android experience, Agile delivery with xLab / Progressive, graduate CS training from Case Western Reserve University, and projects across ML, web, GPU systems, data, and blockchain.",
      "That combination suggests he can learn quickly, collaborate with product/engineering teams, and turn ambiguous technical work into usable software.",
    ].join("\n"),
    [
      "For hiring teams, Jical's value is range plus execution.",
      "He has shipped Android work with Java/Kotlin/Firebase, worked in an Agile software environment, supported students with computer security/debugging, and built projects that show applied AI, backend/web, and systems thinking.",
      "He is a good fit for teams that want someone curious, practical, and ready to grow into larger engineering ownership.",
    ].join("\n"),
  ]);

  const getReply = (question) => {
    const clean = normalize(question);
    const tokens = tokenize(clean);

    if (["hi", "hello", "hey", "hii", "yo"].includes(clean)) {
      return "Hi, I am Jical's portfolio assistant. Ask me naturally about his projects, experience, education, skills, resume, or why he may be a good fit.";
    }

    if (wants(clean, ["tell me more", "more about", "that project", "that one", "details"])) {
      if (lastProject) return `${lastProject.summary}\n\nWhy it matters: it shows Jical can connect technical implementation with a practical user-facing outcome.`;
      if (lastIntent === "experience") return experienceCatalog.join("\n");
      if (lastIntent === "projects") return listProjects(projectCatalog.slice(0, 4));
    }

    if (
      wants(clean, ["why hire", "why should", "good fit", "candidate", "strong candidate", "choose him", "hire him", "hire jical", "should we hire", "why jical"])
      || (tokens.includes("hire") && tokens.some((token) => ["why", "should", "candidate", "fit", "choose"].includes(token)))
    ) {
      lastIntent = "pitch";
      return getRecruiterPitch();
    }

    if (wants(clean, ["summary", "summarize", "short intro", "introduction", "pitch", "about him"])) {
      lastIntent = "overview";
      return "Jical Patel is a software developer who graduated with an MS in Computer Science from Case Western Reserve University. He has experience in Android, web, ML, Agile delivery, and technical support, with projects spanning healthcare AI, audio synthesis, distributed GPU systems, data mining, and blockchain.";
    }

    const project = findProject(clean, tokens);
    if (project?.score >= 1.2) {
      lastIntent = "project";
      lastProject = project;
      return rotateReply(`project-${project.name}`, [
        project.summary,
        `${project.name} is one of Jical's key portfolio pieces. ${project.summary}`,
        `In simple terms: ${project.summary} It shows practical implementation, not just theory.`,
      ]);
    }

    if (wants(clean, ["machine learning", " ml ", " ai ", "healthcare", "audio", "gpu", "distributed", "mobile", "android", "blockchain", "data", "analytics", "backend", "web"])) {
      const category = clean.includes("machine learning") || clean.includes(" ai ") || clean.includes(" ml ") ? "machine learning"
        : clean.includes("health") ? "healthcare"
        : clean.includes("audio") ? "audio"
        : clean.includes("gpu") || clean.includes("distributed") ? "gpu"
        : clean.includes("android") || clean.includes("mobile") ? "mobile"
        : clean.includes("blockchain") ? "blockchain"
        : clean.includes("data") || clean.includes("analytics") ? "data"
        : clean.includes("backend") || clean.includes("web") ? "web"
        : "";
      const matches = projectsByCategory(category);
      if (matches.length) {
        lastIntent = "projects";
        return `Projects related to ${category}:\n${listProjects(matches)}`;
      }
    }

    const scored = knowledge
      .map((item) => ({
        ...item,
        score: scoreItem(clean, tokens, item.keywords, item.weight || 1),
      }))
      .sort((a, b) => b.score - a.score);

    const confident = scored.filter((item) => item.score >= 1.1).slice(0, 2);
    if (confident.length > 1 && confident[1].score > confident[0].score * 0.72) {
      lastIntent = confident[0].intent;
      return confident.map((item) => item.response).join("\n\n");
    }
    if (confident[0]) {
      lastIntent = confident[0].intent;
      return confident[0].response;
    }

    if (tokens.some((token) => ["strong", "strength", "best", "top", "highlight"].includes(token))) {
      lastIntent = "highlights";
      return "Top highlights: xLab / Progressive software developer experience, Android development at TOPS Technology, MedCare healthcare ML, Singing Voice Synthesis audio ML, Distributed HIP DNN Pipeline, and the Skin Disease Identification model with 75% accuracy.";
    }

    return "I may not have that exact detail, but I can answer well about Jical's projects, experience, education, skills, resume, research, and contact. Try asking: 'Which projects use AI?', 'What is his Progressive experience?', 'Give me a recruiter summary', or 'Tell me more about the GPU project.'";
  };

  const openChat = () => {
    shell.classList.add("is-open");
    shell.setAttribute("aria-hidden", "false");
    setTimeout(() => input.focus(), 120);
  };

  const closeChat = () => {
    shell.classList.remove("is-open");
    shell.setAttribute("aria-hidden", "true");
  };

  const appendMessage = (text, type = "bot") => {
    const row = document.createElement("div");
    row.className = `chat-message ${type}`;
    const p = document.createElement("p");
    p.textContent = text;
    row.appendChild(p);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  };

  const ask = (question) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    appendMessage(trimmed, "user");
    input.value = "";

    const thinking = appendMessage("Checking Jical's portfolio...", "bot");
    setTimeout(() => {
      thinking.querySelector("p").textContent = getReply(trimmed);
      messages.scrollTop = messages.scrollHeight;
    }, 220);
  };

  if (footerCta) {
    footerCta.href = "#chatbot";
    footerCta.addEventListener("click", (event) => {
      event.preventDefault();
      openChat();
    });
  }

  document.querySelectorAll("[data-chat-close]").forEach((button) => {
    button.addEventListener("click", closeChat);
  });

  document.querySelectorAll("[data-chat-suggestion]").forEach((button) => {
    button.addEventListener("click", () => ask(button.dataset.chatSuggestion || ""));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.classList.contains("is-open")) {
      closeChat();
    }
  });
}

async function loadAbout() {
  const data = await loadJson("data/about.json");

  setText("about-title", data.title || "");
  setText("about-closing", data.closing || "");
  setText("about-focus-title", data.focus_title || "CURRENT FOCUS");

  const paragraphsContainer = document.getElementById("about-paragraphs");
  if (paragraphsContainer) {
    paragraphsContainer.innerHTML = "";
    (data.paragraphs || []).forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.setAttribute("data-animate", "words");
      paragraph.textContent = text;
      paragraphsContainer.appendChild(paragraph);
    });
  }

  const list = document.getElementById("about-focus-list");
  if (!list) return;

  list.innerHTML = "";
  (data.focus || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });

  setText("about-impact", data.impact || "");

  const tags = document.getElementById("about-tags");
  if (tags) {
    tags.innerHTML = "";
    (data.tags || []).forEach((tag) => {
      const badge = document.createElement("span");
      badge.textContent = tag;
      tags.appendChild(badge);
    });
  }
}

async function loadProjects() {
  const projects = await loadJson("data/projects.json");

  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  grid.innerHTML = "";
  projects.forEach((project) => {
    const card = document.createElement(project.href ? "a" : "article");
    card.className = "project";
    if (project.href) card.href = project.href;

    const meta = document.createElement("div");
    meta.className = "project-meta";
    meta.innerHTML = `<span>${project.period || ""}</span><span>${project.subtitle || ""}</span>`;

    const title = document.createElement("h3");
    title.setAttribute("data-animate", "words");
    title.textContent = project.title || "";

    const description = document.createElement("p");
    description.setAttribute("data-animate", "words");
    description.textContent = project.description || "";

    const tags = document.createElement("div");
    tags.className = "tag-list";
    (project.keywords || []).forEach((keyword) => {
      const tag = document.createElement("span");
      tag.textContent = keyword;
      tags.appendChild(tag);
    });

    const cue = document.createElement("span");
    cue.className = "open-cue";
    cue.textContent = "View case study";

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(tags);
    card.appendChild(cue);
    grid.appendChild(card);
  });
}

async function loadExperience() {
  const experience = await loadJson("data/experience.json");

  const timeline = document.getElementById("experience-timeline");
  if (!timeline) return;

  timeline.innerHTML = "";
  experience.forEach((item) => {
    const row = document.createElement(item.href ? "a" : "div");
    row.className = "item";
    if (item.href) row.href = item.href;

    const year = document.createElement("span");
    year.className = "year";
    year.setAttribute("data-animate", "words");
    year.textContent = item.period || item.year || "";

    const title = document.createElement("h3");
    title.setAttribute("data-animate", "words");
    title.textContent = item.title || "";

    const org = document.createElement("span");
    org.className = "item-org";
    org.textContent = item.organization || "";

    const text = document.createElement("p");
    text.setAttribute("data-animate", "words");
    text.textContent = item.summary || item.text || "";

    const tags = document.createElement("div");
    tags.className = "tag-list";
    (item.keywords || []).forEach((keyword) => {
      const tag = document.createElement("span");
      tag.textContent = keyword;
      tags.appendChild(tag);
    });

    const cue = document.createElement("span");
    cue.className = "open-cue";
    cue.textContent = "Read experience";

    row.appendChild(year);
    row.appendChild(title);
    row.appendChild(org);
    row.appendChild(text);
    row.appendChild(tags);
    row.appendChild(cue);
    timeline.appendChild(row);
  });
}

async function loadEducation() {
  const education = await loadJson("data/education.json");

  const timeline = document.getElementById("education-timeline");
  if (!timeline) return;

  timeline.innerHTML = "";
  education.forEach((item) => {
    const row = document.createElement(item.href ? "a" : "div");
    row.className = "item education-item";
    if (item.href) row.href = item.href;

    const year = document.createElement("span");
    year.className = "year";
    year.setAttribute("data-animate", "words");
    year.textContent = item.period || "";

    const title = document.createElement("h3");
    title.setAttribute("data-animate", "words");
    title.textContent = item.school || "";

    const degree = document.createElement("span");
    degree.className = "item-org";
    degree.textContent = `${item.degree || ""}${item.location ? ` - ${item.location}` : ""}`;

    const text = document.createElement("p");
    text.setAttribute("data-animate", "words");
    text.textContent = item.summary || "";

    const tags = document.createElement("div");
    tags.className = "tag-list";
    (item.keywords || []).forEach((keyword) => {
      const tag = document.createElement("span");
      tag.textContent = keyword;
      tags.appendChild(tag);
    });

    const cue = document.createElement("span");
    cue.className = "open-cue";
    cue.textContent = "Read education";

    row.appendChild(year);
    row.appendChild(title);
    row.appendChild(degree);
    row.appendChild(text);
    row.appendChild(tags);
    row.appendChild(cue);
    timeline.appendChild(row);
  });
}

async function loadContact() {
  const contact = await loadJson("data/contact.json");

  const email = document.getElementById("contact-email");
  if (email) {
    email.textContent = contact.email || "";
    email.href = `mailto:${contact.email || ""}`;
  }

  const linkedin = document.getElementById("contact-linkedin");
  if (linkedin) {
    linkedin.textContent = contact.linkedin_label || "";
    linkedin.href = contact.linkedin_url || "#";
  }

  const phone = document.getElementById("contact-phone");
  if (phone) {
    phone.textContent = contact.phone_label || "";
    phone.href = `tel:${contact.phone_tel || ""}`;
  }
}

async function loadFooter() {
  const data = await loadJson("data/footer.json");

  setText("footer-eyebrow", (data.eyebrow || "").toUpperCase());
  setText("footer-title", data.title || "");
  setText("footer-brand-name", data.brand_name || "");
  setText("footer-brand-role", data.brand_role || "");
  setText("footer-copyright", data.copyright || "");

  const cta = document.getElementById("footer-cta");
  if (cta) {
    cta.textContent = data.cta_label || "Start a Conversation";
    cta.href = data.cta_href || "#contact";
  }

  const quick = document.getElementById("footer-quick-links");
  if (quick) {
    quick.innerHTML = "";
    (data.quick_links || []).forEach((item) => {
      const a = document.createElement("a");
      a.href = item.href || "#";
      a.textContent = item.label || "";
      quick.appendChild(a);
    });
  }

  const social = document.getElementById("footer-social-links");
  if (social) {
    social.innerHTML = "";
    (data.social_links || []).forEach((item) => {
      const a = document.createElement("a");
      a.href = item.href || "#";
      a.textContent = item.label || "";
      if (a.href.startsWith("http")) {
        a.target = "_blank";
        a.rel = "noreferrer";
      }
      social.appendChild(a);
    });
  }
}

async function init() {
  setupSmoothScroll();
  setupScrollProgress();
  setupParallaxGlow();
  setupHeaderBehavior();
  setupChatbot();

  try {
    await setupCounters();
    await Promise.all([loadAbout(), loadEducation(), loadProjects(), loadExperience(), loadContact(), loadFooter()]);
    setupWordByWordAnimations();
    setupWordObserver();
    setupRevealAnimations();
  } catch (error) {
    console.error("Failed to load portfolio data files:", error);
  }
}

init();

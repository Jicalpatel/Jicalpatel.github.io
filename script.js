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

  const answers = [
    {
      keywords: ["project", "projects", "work", "built", "portfolio"],
      response: "Jical's strongest projects include MedCare, Singing Voice Synthesis, Distributed HIP DNN Pipeline, Hybrid Bucket-Radix Sorting, Co-Purchasing Recommendation, Uber Clone, and Skin Disease Identification. The projects show healthcare AI, audio ML, GPU/distributed systems, data mining, mobile apps, and blockchain ideas.",
    },
    {
      keywords: ["experience", "job", "work history", "progressive", "xlab"],
      response: "Jical's experience includes Software Developer work with xLab / Progressive Insurance, Graduate Assistant work at Case Western Reserve University, Android Developer work at TOPS Technology, and Office Assistant work supporting technology and operations at Siegal Lifelong Learning.",
    },
    {
      keywords: ["education", "study", "school", "university", "degree", "master", "bachelor"],
      response: "Jical is pursuing a Master's in Computer Science at Case Western Reserve University. He also studied Data Analysis with Computer Application at San Francisco State University and completed a Bachelor of Engineering in Computer Engineering at LDRP-ITR.",
    },
    {
      keywords: ["skill", "skills", "stack", "technology", "programming", "tools"],
      response: "Jical's technical skills include Java, Kotlin, C, C++, Python, SQL, data structures and algorithms, Android Studio, Firebase, REST APIs, MySQL, SQLite, Cloud Firestore, Git, debugging, Tableau, UI/UX design, and performance optimization.",
    },
    {
      keywords: ["resume", "cv"],
      response: "You can open Jical's resume from the footer Resume link. It includes education, experience, projects, research, certifications, and technical skills.",
    },
    {
      keywords: ["contact", "email", "linkedin", "phone", "hire", "connect"],
      response: "You can contact Jical by email at jicalharish15102002@gmail.com or through LinkedIn at linkedin.com/in/jical-patel. For phone number access, please email first.",
    },
    {
      keywords: ["medcare", "healthcare", "disease prediction"],
      response: "MedCare is a healthcare ML project where Jical developed disease prediction machine learning models and integrated them with a Django web interface.",
    },
    {
      keywords: ["skin", "disease", "tensorflow", "keras", "openvino"],
      response: "Skin Disease Identification used TensorFlow, Keras, and OpenVINO. The resume highlights a 75% accuracy AI model and a mobile-friendly UI for easier diagnosis access.",
    },
    {
      keywords: ["uber", "blockchain", "ethereum", "smart contract"],
      response: "The Uber Clone project is a blockchain-based ride-hailing system with smart contracts, Ethereum Rinkeby Testnet crypto payments, real-time GPS tracking, and automated fare calculations.",
    },
    {
      keywords: ["singing", "voice", "audio", "hifigan", "fastspeech"],
      response: "Singing Voice Synthesis converts lyrics into sung audio using FastSpeech2 Conformer, HiFi-GAN, transfer learning, the Children's Song Dataset, and a Gradio interface.",
    },
  ];

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
  };

  const getReply = (question) => {
    const clean = question.toLowerCase();
    const match = answers.find((item) => item.keywords.some((keyword) => clean.includes(keyword)));
    if (match) return match.response;

    return "Good question. I can help with Jical's projects, experience, education, skills, resume, or contact details. Try asking: 'What projects has Jical built?'";
  };

  const ask = (question) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    appendMessage(trimmed, "user");
    input.value = "";
    setTimeout(() => appendMessage(getReply(trimmed), "bot"), 260);
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

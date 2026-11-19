(() => {
  const EXT_NAME = "st-cozy-messenger";
  const PROMPT_KEY = "cozy_messenger_prompt";

  const STRICT_SMS_PROMPT = `[Phone & Messenger Formatting Rule — STRICT]
Apply ONLY when {{char}} writes, sends, reads, or replies to messages on a phone/messenger/screen. This rule OVERRIDES general literary quote/dash dialogue rules («...» or — ...) ONLY for phone/messenger messages (keep face-to-face spoken dialogue and physical actions as normal literary prose):
1. Fixed prefixes by character identity (regardless of 1st-person or 3rd-person POV):
   - EVERY phone message written or sent by {{char}} MUST start on its own separate line with \`(in) \` — even when {{char}} is the one typing and pressing "send".
   - \`(out) \` is strictly reserved for {{user}}'s phone messages. NEVER use \`(out)\` for {{char}}'s replies.
2. STRICT NO-QUOTES & NO-DIRECT-SPEECH IN SMS:
   - NEVER wrap phone message text in quotes («...», "...", “...”, '...').
   - NEVER format phone messages as direct speech with dashes (— ...) or wrap \`(in)\` lines in italics/bold (*...*).
   - NEVER place SMS text inside a narrative paragraph — always put a line break before and after each \`(in)\` line.
   - Multiple separate SMS bubbles = multiple separate \`(in)\` lines.
   - Voice message without transcript: \`(in) голосовое: 0:04\`
   - Sticker/emoji bubble: \`(in) стикер: 🐾\`

WRONG (forbidden when texting on phone):
Набираю ответ одной рукой:
«У тебя часы сломались? Чего не спишь?»
Нажимаю «отправить».

CORRECT (required when texting on phone):
Набираю ответ одной рукой:
(in) У тебя часы сломались?
(in) Чего не спишь?
Нажимаю «отправить».`;

  const defaultSettings = {
    extensionEnabled: true,
    autoPrompt: true,
    sound: true,
    volume: 0.4,
    compactMode: false,
    cozyMascot: true,
    showFooter: true,
    theme: "glass",
    favorites: [],
    reactions: {}
  };

  const THEME_CLASSES = [
    "st-cm-theme-latte",
    "st-cm-theme-pink",
    "st-cm-theme-matcha",
    "st-cm-theme-noir",
    "st-cm-theme-neon",
    "st-cm-theme-dark"
  ];

  const THEME_DRINKS = {
    glass: "☕",
    latte: "☕",
    pink: "🌸",
    matcha: "🍵",
    noir: "🍷",
    neon: "🍸",
    dark: "🌙"
  };

  const REACTIONS = ["❤️", "🔥", "🐾", "🥺", "✨", "😂"];

  const SCENE_STATUS_RULES = [
    {
      re: /недоступен|выключен|вне зоны|не в сети|не отвечал|сбросил|абонент|offline/i,
      status: "не в сети • недоступен",
      offline: true
    },
    {
      re: /дожд|ливень|гроз|гром|зонт|туч|окн|капл|rain|storm/i,
      status: "в сети • 🌧️ онлайн",
      offline: false
    },
    {
      re: /кофе|чай|какао|кружк|латте|кафе|таверн|камин|кост[её]р|плед|уют|coffee|tea|cozy|fire/i,
      status: "в сети • ☕ онлайн",
      offline: false
    },
    {
      re: /ноч|лун|звезд|темнот|полноч|спать|сон|кроват|тишин|night|moon|sleep/i,
      status: "в сети • 🌙 не спит",
      offline: false
    },
    {
      re: /губ|объяти|нежн|сердц|люб|поцел|щек|румян|ладон|тепл|палат|бинт|таблетк|болит|kiss|love|heart/i,
      status: "в сети • 💌 онлайн",
      offline: false
    },
    {
      re: /.*/,
      status: "в сети • онлайн",
      offline: false
    }
  ];

  // SVG уютного котика в шапке телефона
  const CAT_SVG = `<svg viewBox="0 0 32 22" aria-hidden="true"><path class="st-cat-tail" d="M6 16 C2 15, 1 9, 4 7"/><ellipse cx="15" cy="15" rx="8.2" ry="4.8"/><circle cx="23" cy="11.5" r="4.1"/><polygon points="20,8.5 21.2,3.8 23.8,7.5"/><polygon points="23.5,7.5 26.2,4.1 26.8,8.8"/></svg><span class="st-cm-cat-heart">♥</span>`;

  const DEFAULT_CHAR_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8ec5fc"/><stop offset="100%" stop-color="#6259ca"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(#g)"/><circle cx="32" cy="25" r="11" fill="rgba(255,255,255,0.9)"/><path d="M14 54c3-11 11-16 18-16s15 5 18 16" fill="rgba(255,255,255,0.9)"/></svg>`
  )}`;

  function getSettings() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx) return defaultSettings;
    if (!ctx.extensionSettings[EXT_NAME]) {
      ctx.extensionSettings[EXT_NAME] = { ...defaultSettings };
    }
    const s = ctx.extensionSettings[EXT_NAME];
    if (s.autoPrompt === undefined) {
      s.autoPrompt = s.enabled !== undefined ? Boolean(s.enabled) : true;
    }
    for (const k of Object.keys(defaultSettings)) {
      if (s[k] === undefined) s[k] = defaultSettings[k];
    }
    delete s.autoWidget;
    delete s.enabled;
    if (!Array.isArray(s.favorites)) s.favorites = [];
    if (!s.reactions || typeof s.reactions !== "object" || Array.isArray(s.reactions)) {
      s.reactions = {};
    }
    return s;
  }

  // Инжект строгой инструкции формата (in) / (out) без кавычек и прямой речи
  function updatePrompt() {
    const ctx = window.SillyTavern?.getContext?.();
    if (typeof ctx?.setExtensionPrompt !== "function") return;
    const s = getSettings();
    const active = s.extensionEnabled !== false && s.autoPrompt !== false;
    const charLabel = !isSystemName(ctx?.name2) ? ctx.name2.trim() : "{{char}}";
    const userLabel = !isSystemName(ctx?.name1) ? ctx.name1.trim() : "{{user}}";
    const promptValue = active
      ? STRICT_SMS_PROMPT.replace(/\{\{char\}\}/g, charLabel).replace(/\{\{user\}\}/g, userLabel)
      : "";
    const pos = ctx.extension_prompt_types?.IN_CHAT ?? 1;
    const role = ctx.extension_prompt_roles?.SYSTEM ?? 0;
    try {
      ctx.setExtensionPrompt(PROMPT_KEY, promptValue, pos, 0, false, role);
    } catch (e) {
      try {
        ctx.setExtensionPrompt(PROMPT_KEY, promptValue, 1, 0);
      } catch (err) {}
    }
  }

  function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function decodeHtmlEntities(str = "") {
    return String(str)
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, dec) => {
        const cp = parseInt(dec, 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const cp = parseInt(hex, 16);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
      })
      .replace(/&amp;/gi, "&");
  }

  function cleanField(str = "") {
    return decodeHtmlEntities(String(str).replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanMultilinePayload(str = "") {
    return decodeHtmlEntities(
      String(str)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li)>\s*<(?:p|div|li)[^>]*>/gi, "\n")
        .replace(/<[^>]*>/g, "")
    )
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .join("\n")
      .trim();
  }

  function hashText(str = "") {
    let h = 2166136261;
    const s = String(str);
    const len = s.length;
    const step = len > 2000 ? Math.floor(len / 2000) : 1;
    for (let i = 0; i < len; i += step) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function isSystemName(name = "") {
    const trimmed = String(name || "").trim();
    return !trimmed || /^sillytavern\s*system$/i.test(trimmed) || /^system$/i.test(trimmed);
  }

  // Получение реального имени и аватарки персонажа/игрока из SillyTavern
  function getTavernProfile(mesEl = null, isPreview = false) {
    const ctx = window.SillyTavern?.getContext?.();
    const hasActiveChar = ctx && (ctx.characterId !== undefined && ctx.characterId !== null || Boolean(ctx.groupId));
    let charName = !isSystemName(ctx?.name2) ? ctx.name2.trim() : "";
    let userName = !isSystemName(ctx?.name1) ? ctx.name1.trim() : "Я";
    let charAvatar = "";
    let userAvatar = "";

    if (mesEl) {
      const isUserMes = mesEl.getAttribute("is_user") === "true";
      const isSysMes = mesEl.getAttribute("is_system") === "true";
      if (!isUserMes && !isSysMes) {
        const chNameEl = mesEl.querySelector(".ch_name .name_text, .name_text");
        const candidateName = chNameEl?.textContent?.trim() || "";
        if (!isSystemName(candidateName)) {
          charName = candidateName;
        }
        const avImg = mesEl.querySelector(".avatar img");
        if (avImg?.getAttribute("src")) {
          charAvatar = avImg.getAttribute("src");
        }
      }
    }

    if (!isPreview || hasActiveChar) {
      if (!charName) {
        const charNameNodes = document.querySelectorAll('#chat .mes[is_user="false"]:not([is_system="true"]) .ch_name .name_text, #chat .mes[is_user="false"]:not([is_system="true"]) .name_text');
        for (let i = charNameNodes.length - 1; i >= 0; i--) {
          const candidate = charNameNodes[i].textContent?.trim() || "";
          if (!isSystemName(candidate)) {
            charName = candidate;
            break;
          }
        }
      }

      if (!charAvatar) {
        const charImgs = document.querySelectorAll('#chat .mes[is_user="false"]:not([is_system="true"]) .avatar img');
        const lastCharImg = charImgs.length > 0 ? charImgs[charImgs.length - 1] : null;
        if (lastCharImg?.getAttribute("src")) {
          charAvatar = lastCharImg.getAttribute("src");
        } else if (ctx?.characters && ctx?.characterId !== undefined && ctx?.characterId !== null) {
          const c = ctx.characters[ctx.characterId];
          if (c?.avatar) {
            charAvatar = `/characters/${encodeURIComponent(c.avatar)}`;
          }
        }
      }
    }

    const userImgs = document.querySelectorAll('#chat .mes[is_user="true"] .avatar img');
    const lastUserImg = userImgs.length > 0 ? userImgs[userImgs.length - 1] : null;
    if (lastUserImg?.getAttribute("src")) {
      userAvatar = lastUserImg.getAttribute("src");
    }

    return {
      charName: charName || "Собеседник",
      userName: userName || "Я",
      charAvatar: charAvatar || DEFAULT_CHAR_AVATAR,
      userAvatar: userAvatar || DEFAULT_CHAR_AVATAR
    };
  }

  function extractMesBaseTime(mesEl, seedStr = "") {
    if (mesEl) {
      const tsEl = mesEl.querySelector(".mes_block .timestamp, .timestamp");
      const tsText = tsEl?.textContent || "";
      const timeMatch = tsText.match(/(\b\d{1,2}):(\d{2})\b/);
      if (timeMatch) {
        let hh = parseInt(timeMatch[1], 10);
        const mm = parseInt(timeMatch[2], 10);
        if (/pm/i.test(tsText) && hh < 12) hh += 12;
        if (/am/i.test(tsText) && hh === 12) hh = 0;
        if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
          return { hour: hh, minute: mm };
        }
      }
    }
    const h = hashText(seedStr);
    return {
      hour: 19 + (h % 5),
      minute: (h >>> 5) % 60
    };
  }

  function formatTimeOffset(baseHour, baseMinute, offsetMinutes = 0) {
    const total = ((baseHour * 60 + baseMinute + offsetMinutes) % 1440 + 1440) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function applyTheme() {
    const s = getSettings();
    document.body.classList.remove(...THEME_CLASSES);
    if (s.extensionEnabled === false) return;
    if (s.theme && s.theme !== "glass") {
      document.body.classList.add(`st-cm-theme-${s.theme}`);
    }
    const drink = THEME_DRINKS[s.theme] || "☕";
    document.querySelectorAll(".st-cm-drink-badge").forEach((el) => {
      el.textContent = drink;
    });
    document.querySelectorAll(".st-cm-cat").forEach((el) => {
      el.style.display = s.cozyMascot === false ? "none" : "";
    });
    document.querySelectorAll(".st-cm-footer").forEach((el) => {
      el.style.display = s.showFooter === false ? "none" : "";
    });
  }

  // ============================================================================
  // WEB AUDIO ENGINE (iOS Silent Mode Support + SMS Chimes & Cat Purr)
  // ============================================================================
  let audioCtx = null;
  let iosUnlockAudioEl = null;
  const SILENT_WAV_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

  function unlockAudioEngine() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== "playback") {
        navigator.audioSession.type = "playback";
      }
    } catch (e) {}

    try {
      if (!iosUnlockAudioEl) {
        iosUnlockAudioEl = new Audio(SILENT_WAV_URI);
        iosUnlockAudioEl.setAttribute("playsinline", "true");
        iosUnlockAudioEl.volume = 0.01;
      }
      const p = iosUnlockAudioEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {}

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended" || audioCtx.state === "interrupted") {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  function getVolume() {
    const s = getSettings();
    const v = typeof s.volume === "number" ? s.volume : 0.4;
    return Math.max(0.05, Math.min(1, v));
  }

  // 🔔 Звук уведомления СМС / смены реакции / голосового
  function playSmsSound(type = "incoming", forcePreview = false) {
    const s = getSettings();
    if (s.extensionEnabled === false) return;
    if (!forcePreview && !s.sound) return;
    const ctx = unlockAudioEngine();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = getVolume() * 0.55;
    master.connect(ctx.destination);

    if (type === "incoming") {
      const notes = [587.33, 880.0];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        const t = now + i * 0.085;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.28, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.36);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } else if (type === "outgoing") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.09);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.25, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === "react") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(790, now + 0.065);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (type === "voice") {
      const chords = [392.0, 493.88, 587.33, 659.25, 587.33, 493.88];
      chords.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? "triangle" : "sine";
        const t = now + i * 0.16;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.36);
      });
    }
  }

  // 🐾 Мурчание котика в шапке мессенджера
  function playCatPurr() {
    const s = getSettings();
    if (s.extensionEnabled === false || !s.sound) return;
    const ctx = unlockAudioEngine();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.65, getVolume() * 0.85);
    master.connect(ctx.destination);

    const carrier = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const purrGain = ctx.createGain();

    carrier.type = "triangle";
    carrier.frequency.setValueAtTime(52, now);
    carrier.frequency.linearRampToValueAtTime(64, now + 0.35);
    carrier.frequency.linearRampToValueAtTime(48, now + 0.85);

    lfo.type = "sine";
    lfo.frequency.value = 24;
    lfoGain.gain.value = 18;

    filter.type = "lowpass";
    filter.frequency.value = 220;

    purrGain.gain.setValueAtTime(0.001, now);
    purrGain.gain.linearRampToValueAtTime(0.24, now + 0.12);
    purrGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(purrGain);
    purrGain.connect(master);

    carrier.start(now);
    lfo.start(now);
    carrier.stop(now + 0.92);
    lfo.stop(now + 0.92);

    const meow = ctx.createOscillator();
    const meowGain = ctx.createGain();
    meow.type = "sine";
    meow.frequency.setValueAtTime(590, now + 0.08);
    meow.frequency.exponentialRampToValueAtTime(770, now + 0.22);
    meow.frequency.exponentialRampToValueAtTime(520, now + 0.55);
    meowGain.gain.setValueAtTime(0.001, now + 0.08);
    meowGain.gain.linearRampToValueAtTime(0.1, now + 0.16);
    meowGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);
    meow.connect(meowGain);
    meowGain.connect(master);
    meow.start(now + 0.08);
    meow.stop(now + 0.6);
  }

  // ============================================================================
  // ПАРСИНГ СООБЩЕНИЙ (IN) / (OUT), ГОЛОСОВЫХ, СТИКЕРОВ И ТЕГА [SMS: ...]
  // ============================================================================
  function formatVoiceDuration(raw = "") {
    const clean = String(raw || "").trim();
    if (!clean) return "0:04";
    const timeMatch = clean.match(/(\d{1,2}:\d{2})/);
    if (timeMatch) return timeMatch[1];
    const secMatch = clean.match(/^(\d{1,2})\s*(?:с|сек|s|sec)?$/i);
    if (secMatch) {
      const s = Math.max(1, Math.min(59, parseInt(secMatch[1], 10)));
      return `0:${s < 10 ? "0" + s : s}`;
    }
    const estSec = Math.max(2, Math.min(45, Math.round(clean.length / 11)));
    return `0:${estSec < 10 ? "0" + estSec : estSec}`;
  }

  function sanitizeSmsText(raw = "") {
    let s = String(raw || "").trim();
    if (!s) return "";
    // Убираем случайное тире прямой речи в начале СМС ("— Текст" -> "Текст")
    s = s.replace(/^(?:—|–|-\s+)\s*/, "").trim();
    // Убираем внешние парные кавычки вокруг всего СМС, если внутри нет других таких же кавычек
    if (s.length >= 2) {
      if (s.startsWith("«") && s.endsWith("»") && !/[«»]/.test(s.slice(1, -1))) {
        s = s.slice(1, -1).trim();
      } else if (s.startsWith("“") && s.endsWith("”") && !/[“”]/.test(s.slice(1, -1))) {
        s = s.slice(1, -1).trim();
      } else if (s.startsWith('"') && s.endsWith('"') && !s.slice(1, -1).includes('"')) {
        s = s.slice(1, -1).trim();
      }
    }
    return s;
  }

  function renderBubbleContent(rawMsg = "") {
    const trimmed = sanitizeSmsText(rawMsg);

    // 1. Голосовое сообщение в стиле Telegram: голосовое: 0:03 | гс: 0:06 | voice: 0:12
    const voiceMatch = trimmed.match(
      /^\[?(?:голосовое(?:\s+сообщение)?|гс|голос|voice(?:\s+message)?|аудио|audio)(?:\s*[:\-]\s*([\s\S]*?))?\]?$/i
    );
    if (voiceMatch) {
      const rawArg = (voiceMatch[1] || "").trim();
      const dur = escapeHtml(formatVoiceDuration(rawArg));
      const isPureTimer = !rawArg || /^\d{1,2}(?::\d{2}|\s*(?:с|сек|s|sec)?)?$/i.test(rawArg);
      const hint = isPureTimer
        ? "Нажми, чтобы прослушать голосовое"
        : `Голосовое сообщение: ${rawArg}`;
      return `<div class="st-cm-voice" title="${escapeHtml(hint)}"><div class="st-cm-voice-play">▶</div><div class="st-cm-voice-waves"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><span class="st-cm-voice-dur">${dur}</span></div>`;
    }

    // 2. Стикер: стикер: 🐾 или [стикер: 🐾]
    const stickerMatch = trimmed.match(/^\[?(?:стикер|sticker)\s*[:\-]\s*([\s\S]+?)\]?$/i);
    if (stickerMatch) {
      return `<div class="st-cm-sticker">${escapeHtml(stickerMatch[1].trim())}</div>`;
    }

    return `<div class="st-cm-text">${escapeHtml(trimmed)}</div>`;
  }

  function isUserSender(sender = "", userName = "Я") {
    const s = sender.trim().toLowerCase();
    const u = String(userName || "").trim().toLowerCase();
    return (
      s === "out" ||
      s === "исх" ||
      s === "я" ||
      s === "me" ||
      s === "user" ||
      s === "ты" ||
      s === "you" ||
      s === "{{user}}" ||
      (Boolean(u) && s === u)
    );
  }

  function detectSceneStatus(contextText = "") {
    const matched = SCENE_STATUS_RULES.find((m) => m.re.test(contextText)) || SCENE_STATUS_RULES[SCENE_STATUS_RULES.length - 1];
    return {
      status: matched.status,
      offline: Boolean(matched.offline)
    };
  }

  // Надёжный парсер тегов [sms: ...] с поддержкой вложенных скобок ([стикер: ...], [печатает])
  function replaceSmsTags(htmlStr = "", replacer) {
    const openRe = /\[(?:sms|chat|смс):\s*/gi;
    let result = "";
    let lastPos = 0;
    let match;

    while ((match = openRe.exec(htmlStr)) !== null) {
      const startIdx = match.index;
      const payloadStart = startIdx + match[0].length;
      let depth = 1;
      let endIdx = -1;

      for (let i = payloadStart; i < htmlStr.length; i++) {
        const ch = htmlStr[i];
        if (ch === "[") {
          depth++;
        } else if (ch === "]") {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) {
        break;
      }

      const afterSlice = htmlStr.slice(endIdx + 1, endIdx + 8);
      if (/^\s*—/.test(afterSlice)) {
        openRe.lastIndex = endIdx + 1;
        continue;
      }

      const rawPayload = htmlStr.slice(payloadStart, endIdx);
      result += htmlStr.slice(lastPos, startIdx) + replacer(rawPayload);
      lastPos = endIdx + 1;
      openRe.lastIndex = lastPos;
    }

    if (lastPos === 0) return { changed: false, html: htmlStr };
    result += htmlStr.slice(lastPos);
    return { changed: true, html: result };
  }

  function parseSmsTagPayload(payload, profile, contextText = "") {
    const cleaned = cleanMultilinePayload(payload);
    const segments = cleaned
      .split(/\r?\n|\s*\|\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    const sceneState = detectSceneStatus(contextText);
    let contactName = profile.charName || "Собеседник";
    let status = sceneState.status;
    let offline = sceneState.offline;
    const messages = [];
    let showTyping = false;

    if (segments.length === 0) {
      return { contactName, status, offline, messages, showTyping };
    }

    let startIdx = 0;
    const first = segments[0];
    const isSpecialFirst =
      /^\(\s*(?:in|out|вх|исх)\s*\)/i.test(first) ||
      /^\[?(?:печатает|typing|\.{3}|…|голосовое|гс|голос|voice|аудио|audio|стикер|sticker)\b/i.test(first);

    if (segments.length >= 2 && !isSpecialFirst && !first.includes(":") && !/[?!]$/.test(first) && first.length <= 28) {
      contactName = cleanField(first) || contactName;
      startIdx = 1;
      if (
        segments.length > 2 &&
        !/^\(\s*(?:in|out|вх|исх)\s*\)/i.test(segments[1]) &&
        (!segments[1].includes(":") || /в сети|онлайн|online|недоступен|выключен|печатает|typing|был|недавно|🌙|☕|🌧|✨|💌/i.test(segments[1])) &&
        !/[?!]$/.test(segments[1])
      ) {
        status = cleanField(segments[1]) || status;
        offline = /недоступен|выключен|не в сети|offline/i.test(status);
        startIdx = 2;
      }
    }

    for (let i = startIdx; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg) continue;

      if (/^\[?(?:печатает|typing|\.{3}|…)\]?$/i.test(seg)) {
        showTyping = true;
        continue;
      }

      const inOutMatch = seg.match(/^\(\s*(in|out|вх|исх)\s*\)\s*([\s\S]+)$/i);
      if (inOutMatch) {
        const dir = inOutMatch[1].toLowerCase();
        const isOut = dir === "out" || dir === "исх";
        const body = stripSmsSpeechWrappers(inOutMatch[2]);
        if (/^\[?(?:печатает|typing|\.{3}|…)\]?$/i.test(body) && !isOut) {
          showTyping = true;
          continue;
        }
        messages.push({
          sender: isOut ? profile.userName : contactName,
          isUser: isOut,
          text: body
        });
        continue;
      }

      const prefixMatch = seg.match(/^([^:\[\]]{1,28}):\s*([\s\S]+)$/);
      if (prefixMatch && !/^(?:голосовое|гс|голос|voice|аудио|audio|стикер|sticker)$/i.test(prefixMatch[1].trim())) {
        const sender = cleanField(prefixMatch[1]);
        const msgText = prefixMatch[2].trim();
        const userFlag = isUserSender(sender, profile.userName);
        if (/^\[?(?:печатает|typing|\.{3}|…)\]?$/i.test(msgText) && !userFlag) {
          showTyping = true;
          continue;
        }
        messages.push({
          sender: userFlag ? profile.userName : sender,
          isUser: userFlag,
          text: msgText
        });
      } else {
        messages.push({
          sender: contactName,
          isUser: false,
          text: seg
        });
      }
    }

    if (messages.length === 0 && !showTyping && segments.length > 0) {
      messages.push({
        sender: contactName,
        isUser: false,
        text: segments[segments.length - 1]
      });
    }

    return { contactName, status, offline, messages, showTyping };
  }

  function makeLegacyFavKey(contact = "", firstText = "") {
    return `${String(contact).trim().toLowerCase()}|${String(firstText).trim().toLowerCase().slice(0, 60)}`;
  }

  function makeFavKeyFromData(contact = "", messages = [], summary = "") {
    const c = String(contact).trim().toLowerCase();
    if (Array.isArray(messages) && messages.length > 0) {
      const joined = messages.map((m) => `${m.isUser ? "1" : "0"}:${String(m.text || "").trim()}`).join("\n");
      return `${c}|${messages.length}|${hashText(joined)}`;
    }
    return makeLegacyFavKey(contact, summary);
  }

  function findFavoriteIndex(favs, favKey, legacyKey) {
    return favs.findIndex((f) => {
      const fKey = f.favKey || makeFavKeyFromData(f.contactName, f.messages, f.summary);
      const fLegacy = makeLegacyFavKey(f.contactName, f.summary);
      return fKey === favKey || (legacyKey && fLegacy === legacyKey);
    });
  }

  function makeBubbleMsgKey(contactName, isUser, idx, text) {
    return `${String(contactName || "").trim().toLowerCase()}|${isUser ? 1 : 0}|${idx}|${hashText(String(text || "").trim())}`;
  }

  function buildPhoneHtml(data, profile, mesEl = null) {
    const s = getSettings();
    const contactName = cleanField(data.contactName || profile.charName || "Собеседник");
    const status = cleanField(data.status || "в сети • онлайн");
    const isOffline = Boolean(data.offline) || /недоступен|выключен|не в сети|offline/i.test(status);
    const hasMessages = Array.isArray(data.messages) && data.messages.length > 0;
    const messages = hasMessages
      ? data.messages
      : data.showTyping
        ? []
        : [{ sender: contactName, isUser: false, text: "..." }];

    const firstSummary = cleanField(messages[0]?.text || (data.showTyping ? "печатает..." : ""));
    const favKey = data.favKey || makeFavKeyFromData(contactName, messages, firstSummary);
    const legacyKey = makeLegacyFavKey(contactName, firstSummary);
    const fav = findFavoriteIndex(s.favorites, favKey, legacyKey) >= 0;

    const drinkIcon = THEME_DRINKS[s.theme] || "☕";
    const compactClass = s.compactMode ? "is-compact" : "";
    const resolvedAvatar = data.charAvatar || profile.charAvatar || DEFAULT_CHAR_AVATAR;
    const charAvatar = escapeHtml(resolvedAvatar);

    const baseTime = data.baseTime && typeof data.baseTime.hour === "number"
      ? data.baseTime
      : extractMesBaseTime(mesEl, contactName + "|" + firstSummary);
    const headerTimeStr = formatTimeOffset(baseTime.hour, baseTime.minute, Math.max(0, messages.length - 1));

    const rowsHtml = messages
      .map((m, idx) => {
        const isUser = Boolean(m.isUser);
        const rowCls = isUser ? "is-user" : "is-char";
        const timeStr = m.time || formatTimeOffset(baseTime.hour, baseTime.minute, idx);
        const avatarHtml = !isUser
          ? `<img class="st-cm-mini-avatar" src="${charAvatar}" alt="av">`
          : "";
        const checksHtml = isUser ? `<span class="st-cm-checks">${isOffline ? "✓" : "✓✓"}</span>` : "";
        const bodyHtml = renderBubbleContent(m.text);
        const msgKey = makeBubbleMsgKey(contactName, isUser, idx, m.text);
        const savedEmoji = s.reactions?.[msgKey] || "";
        const reactHtml = savedEmoji
          ? `<div class="st-cm-react" data-emoji="${escapeHtml(savedEmoji)}">${escapeHtml(savedEmoji)} 1</div>`
          : "";

        return `<div class="st-cm-row ${rowCls}">${avatarHtml}<div class="st-cm-bubble ${rowCls}" data-msg-key="${escapeHtml(msgKey)}" title="Нажми на сообщение, чтобы поставить реакцию">${bodyHtml}<div class="st-cm-meta"><span>${escapeHtml(timeStr)}</span>${checksHtml}</div>${reactHtml}</div></div>`;
      })
      .join("");

    const typingHtml = data.showTyping
      ? `<div class="st-cm-typing" title="${escapeHtml(contactName)} печатает..."><span></span><span></span><span></span></div>`
      : "";

    const payloadJson = escapeHtml(
      JSON.stringify({
        favKey,
        contactName,
        charAvatar: resolvedAvatar,
        status,
        offline: isOffline,
        summary: firstSummary,
        baseTime,
        showTyping: Boolean(data.showTyping),
        messages
      })
    );

    return `<div class="st-cm-phone ${compactClass}" data-fav-key="${escapeHtml(favKey)}" data-contact="${escapeHtml(contactName)}" data-summary="${escapeHtml(firstSummary)}" data-payload="${payloadJson}">
      <div class="st-cm-statusbar">
        <span>${escapeHtml(headerTimeStr)}</span>
        <div class="st-cm-island"><span class="st-cm-island-lens"></span><span class="st-cm-island-led"></span></div>
        <span>5G • 100%</span>
      </div>
      <div class="st-cm-header">
        <div class="st-cm-avatar-wrap">
          <img class="st-cm-avatar" src="${charAvatar}" alt="${escapeHtml(contactName)}">
          <span class="st-cm-online-ring ${isOffline ? "is-offline" : ""}"></span>
        </div>
        <div class="st-cm-head-info">
          <div class="st-cm-name-row">
            <span class="st-cm-name">${escapeHtml(contactName)}</span>
            <span class="st-cm-drink-badge" title="Напиток текущей темы">${drinkIcon}</span>
          </div>
          <div class="st-cm-status">${escapeHtml(status)}</div>
        </div>
        <div class="st-cm-cat" style="${s.cozyMascot === false ? "display:none;" : ""}" title="Погладить котика">${CAT_SVG}</div>
        <div class="st-cm-actions">
          <span class="st-cm-sound-btn" title="Проверить звук уведомления СМС">🔔</span>
          <span class="st-cm-fav-btn ${fav ? "is-fav" : ""}" title="Сохранить переписку в избранное">${fav ? "♥" : "♡"}</span>
          <span class="st-cm-mini-btn" title="Свернуть / развернуть телефон">${s.compactMode ? "+" : "–"}</span>
        </div>
      </div>
      <div class="st-cm-body">
        <div class="st-cm-date-pill">Сегодня • Cozy Messenger</div>
        ${rowsHtml}
        ${typingHtml}
      </div>
      <div class="st-cm-footer" style="${s.showFooter === false ? "display:none;" : ""}">
        <input type="text" class="st-cm-input" placeholder="Написать СМС для ${escapeHtml(contactName)}...">
        <button type="button" class="st-cm-send" title="Отправить СМС">➤</button>
      </div>
    </div>`;
  }

  const IN_OUT_TEST_RE = /(?:^|\s|>|[«"“*'_—–-])\(\s*(?:in|out|вх|исх)\s*\)/i;
  const IN_OUT_LINE_RE = /^(?:>\s*)?[\*_]*\(\s*(in|out|вх|исх)\s*\)[\*_]*\s*([\s\S]+)$/i;

  // Страховка на случай, если модель всё же обернула текст после (in)/(out) в кавычки или тире прямой речи
  function stripSmsSpeechWrappers(raw = "") {
    let s = String(raw || "").trim();
    s = s.replace(/^[—–-]\s+/, "").trim();
    if (/^«[^«»]+»$/.test(s) || /^"[^"]+"$/.test(s) || /^“[^“”]+”$/.test(s)) {
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  // Группировка строк (in) и (out) прямо внутри ролевого поста с сохранением РП-текста вокруг
  function renderInOutLinesInDom(el, profile, contextText = "", mesEl = null) {
    if (!IN_OUT_TEST_RE.test(el.textContent || "")) {
      return { changed: false, hasIncoming: false };
    }

    if (el.querySelectorAll("p").length === 0 && !el.querySelector(".st-cm-phone")) {
      const rawLines = (el.innerHTML || "")
        .split(/(?:<br\s*\/?>|\r?\n)+/i)
        .map((l) => l.trim())
        .filter(Boolean);
      if (rawLines.length > 0) {
        el.innerHTML = rawLines.map((l) => `<p>${l}</p>`).join("");
      }
    }

    Array.from(el.querySelectorAll("p")).forEach((p) => {
      const pText = p.textContent || "";
      if (!IN_OUT_TEST_RE.test(pText)) return;

      const html = p.innerHTML || "";
      const hasBrOrNewline = /<br\s*\/?>|\r?\n/i.test(html);
      const startsWithMarker = /^\s*\(\s*(?:in|out|вх|исх)\s*\)/i.test(pText);
      const markerCount = (pText.match(/\(\s*(?:in|out|вх|исх)\s*\)/gi) || []).length;

      if (!hasBrOrNewline && !(startsWithMarker && markerCount > 1)) return;

      const preparedHtml = startsWithMarker
        ? html.replace(/(?!^)\s+(?=\(\s*(?:in|out|вх|исх)\s*\))/gi, "<br>")
        : html;

      const splitHtml = preparedHtml
        .split(/(?:<br\s*\/?>|\r?\n)+/i)
        .map((s) => s.trim())
        .filter(Boolean);

      if (splitHtml.length <= 1) return;
      const frag = document.createDocumentFragment();
      splitHtml.forEach((lineHtml) => {
        const newP = document.createElement("p");
        newP.innerHTML = lineHtml;
        frag.appendChild(newP);
      });
      p.replaceWith(frag);
    });

    const children = Array.from(el.childNodes);
    let changed = false;
    let hasIncoming = false;
    let groupNodes = [];
    let groupMessages = [];
    let groupTyping = false;

    const sceneState = detectSceneStatus(contextText);

    const flushGroup = () => {
      if (groupNodes.length === 0 || (groupMessages.length === 0 && !groupTyping)) {
        groupNodes = [];
        groupMessages = [];
        groupTyping = false;
        return;
      }
      if (groupMessages.some((m) => !m.isUser) || groupTyping) {
        hasIncoming = true;
      }
      const phoneHtml = buildPhoneHtml(
        {
          contactName: profile.charName,
          status: sceneState.status,
          offline: sceneState.offline,
          messages: groupMessages,
          showTyping: groupTyping
        },
        profile,
        mesEl
      );
      const wrapper = document.createElement("div");
      wrapper.innerHTML = phoneHtml;
      const phoneNode = wrapper.firstElementChild;
      if (phoneNode) {
        groupNodes[0].replaceWith(phoneNode);
        for (let k = 1; k < groupNodes.length; k++) {
          groupNodes[k].remove();
        }
        changed = true;
      }
      groupNodes = [];
      groupMessages = [];
      groupTyping = false;
    };

    for (let i = 0; i < children.length; i++) {
      const node = children[i];

      if (node.nodeType === 3 && !node.textContent.trim()) {
        if (groupNodes.length > 0) {
          groupNodes.push(node);
        }
        continue;
      }

      if (node.nodeType === 1 && (node.tagName === "P" || node.tagName === "BLOCKQUOTE")) {
        const txt = (node.textContent || "").trim();
        if (!txt) {
          if (groupNodes.length > 0) {
            groupNodes.push(node);
          }
          continue;
        }

        const m = txt.match(IN_OUT_LINE_RE);
        if (m) {
          const dir = m[1].toLowerCase();
          const isOut = dir === "out" || dir === "исх";
          const msgBody = stripSmsSpeechWrappers(m[2]);
          groupNodes.push(node);

          if (/^\[?(?:печатает|typing|\.{3}|…)\]?$/i.test(msgBody) && !isOut) {
            groupTyping = true;
          } else {
            groupMessages.push({
              sender: isOut ? profile.userName : profile.charName,
              isUser: isOut,
              text: msgBody
            });
          }
          continue;
        }
      }

      flushGroup();
    }

    flushGroup();
    return { changed, hasIncoming };
  }

  function renderSmsInElement(el, mesEl = null, isPreview = false) {
    if (!el) return { rendered: false, hasIncoming: false };
    const html = el.innerHTML || "";
    const text = el.textContent || "";
    const hasTag = /\[(?:sms|chat|смс):/i.test(html) || /\[(?:sms|chat|смс):/i.test(text);
    const hasInOut = IN_OUT_TEST_RE.test(text);

    if (!hasTag && !hasInOut) {
      return { rendered: false, hasIncoming: false };
    }

    const profile = getTavernProfile(mesEl, isPreview);
    let rendered = false;
    let hasIncoming = false;

    if (hasInOut) {
      const res = renderInOutLinesInDom(el, profile, text, mesEl);
      if (res.changed) {
        rendered = true;
        if (res.hasIncoming) hasIncoming = true;
      }
    }

    if (hasTag) {
      const currentHtml = el.innerHTML || "";
      const tagRes = replaceSmsTags(currentHtml, (rawPayload) => {
        const parsed = parseSmsTagPayload(rawPayload, profile, text);
        if (parsed.messages.some((m) => !m.isUser) || parsed.showTyping) {
          hasIncoming = true;
        }
        return buildPhoneHtml(parsed, profile, mesEl);
      });
      if (tagRes.changed) {
        el.innerHTML = tagRes.html;
        rendered = true;
      }
    }

    return { rendered, hasIncoming };
  }

  function isDomStreamingNow() {
    const stopBtn = document.getElementById("mes_stop");
    if (stopBtn && stopBtn.offsetParent !== null && getComputedStyle(stopBtn).display !== "none") {
      return true;
    }
    if (document.body.classList.contains("generating")) return true;
    return false;
  }

  let isScanning = false;
  let hasCompletedInitialScan = false;
  const notifiedMesSignatures = new Set();
  const originalMesHtmlMap = new WeakMap();

  function restoreChatWidgets() {
    document.querySelectorAll(".st-cm-auto-mount").forEach((n) => n.remove());
    document.querySelectorAll("#chat .mes .mes_text").forEach((mesText) => {
      delete mesText.dataset.cmScanned;
      if (!mesText.querySelector(".st-cm-phone")) return;
      const savedHtml = originalMesHtmlMap.get(mesText);
      if (typeof savedHtml === "string") {
        mesText.innerHTML = savedHtml;
        return;
      }
      mesText.querySelectorAll(".st-cm-phone").forEach((phoneEl) => {
        let payload = null;
        try {
          payload = JSON.parse(phoneEl.dataset.payload || "null");
        } catch (e) {}
        const frag = document.createDocumentFragment();
        const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
        msgs.forEach((m) => {
          const p = document.createElement("p");
          p.textContent = `(${m.isUser ? "out" : "in"}) ${m.text || ""}`;
          frag.appendChild(p);
        });
        if (payload?.showTyping) {
          const p = document.createElement("p");
          p.textContent = "(in) печатает";
          frag.appendChild(p);
        }
        phoneEl.replaceWith(frag);
      });
    });
  }

  function scanChat() {
    if (isScanning) return;
    isScanning = true;

    try {
      if (getSettings().extensionEnabled === false) {
        restoreChatWidgets();
        return;
      }

      // Удаление старых авто-виджетов, если они остались в DOM от прошлой версии
      document.querySelectorAll(".st-cm-auto-mount").forEach((n) => n.remove());

      const streaming = isDomStreamingNow();
      const allMessages = Array.from(document.querySelectorAll("#chat .mes"));

      allMessages.forEach((mes, idx) => {
        const mesText = mes.querySelector(".mes_text");
        if (!mesText) return;

        const isLastMessage = idx === allMessages.length - 1;
        if (streaming && isLastMessage) {
          return;
        }

        const htmlLen = (mesText.innerHTML || "").length;
        const textSample = mesText.textContent || "";
        const scanSig = `${htmlLen}:${hashText(textSample)}`;
        if (mesText.dataset.cmScanned === scanSig) {
          return;
        }

        const mesId = mes.getAttribute("mesid") || String(idx);
        const swipeId = mes.getAttribute("swipeid") || "0";
        const mesSig = `${mesId}:${swipeId}`;
        const isUser = mes.getAttribute("is_user") === "true";
        const isSystem = mes.getAttribute("is_system") === "true";

        if (!mesText.querySelector(".st-cm-phone")) {
          originalMesHtmlMap.set(mesText, mesText.innerHTML);
        }
        const { rendered, hasIncoming } = renderSmsInElement(mesText, mes, false);
        const finalHtmlLen = (mesText.innerHTML || "").length;
        const finalText = mesText.textContent || "";
        mesText.dataset.cmScanned = `${finalHtmlLen}:${hashText(finalText)}`;

        if (rendered || mesText.querySelector(".st-cm-phone")) {
          if (
            hasCompletedInitialScan &&
            rendered &&
            hasIncoming &&
            isLastMessage &&
            !isUser &&
            !isSystem &&
            !notifiedMesSignatures.has(mesSig)
          ) {
            notifiedMesSignatures.add(mesSig);
            playSmsSound("incoming");
          } else {
            notifiedMesSignatures.add(mesSig);
          }
        }
      });

      if (!streaming) {
        hasCompletedInitialScan = true;
      }
    } finally {
      isScanning = false;
    }
  }

  // ============================================================================
  // ИЗБРАННЫЕ ПЕРЕПИСКИ (ПОЛКА В НАСТРОЙКАХ)
  // ============================================================================
  function renderFavoritesShelf() {
    const listEl = document.getElementById("st_cm_shelf_list");
    const countEl = document.getElementById("st_cm_shelf_count");
    if (!listEl) return;

    const s = getSettings();
    const favs = Array.isArray(s.favorites) ? s.favorites : [];
    if (countEl) countEl.textContent = String(favs.length);

    if (favs.length === 0) {
      listEl.innerHTML = `<div class="st-cm-shelf-empty">Нажми <b>♡</b> в шапке любого телефона в чате, чтобы сохранить любимую СМС-переписку на свою полку ✨</div>`;
      return;
    }

    const fallbackProfile = getTavernProfile(null, true);
    listEl.innerHTML = favs
      .map((f) => buildPhoneHtml(f, fallbackProfile, null))
      .join("");
  }

  function toggleFavoritePhone(phoneEl) {
    const s = getSettings();
    let payload = null;
    try {
      payload = JSON.parse(phoneEl.dataset.payload || "null");
    } catch (e) {}

    const contactName = payload?.contactName || phoneEl.dataset.contact || "Собеседник";
    const summary = payload?.summary || phoneEl.dataset.summary || "";
    const favKey = payload?.favKey || phoneEl.dataset.favKey || makeFavKeyFromData(contactName, payload?.messages, summary);
    const legacyKey = makeLegacyFavKey(contactName, summary);
    const idx = findFavoriteIndex(s.favorites, favKey, legacyKey);

    if (idx >= 0) {
      s.favorites.splice(idx, 1);
    } else {
      s.favorites.unshift(
        payload || {
          favKey,
          contactName,
          status: "в сети • сохранено",
          summary,
          messages: [{ sender: contactName, isUser: false, text: summary }]
        }
      );
    }

    const ctx = window.SillyTavern?.getContext?.();
    ctx?.saveSettingsDebounced?.();

    const isFavNow = idx < 0;
    document.querySelectorAll(".st-cm-phone").forEach((p) => {
      const pFavKey = p.dataset.favKey || "";
      const pLegacy = makeLegacyFavKey(p.dataset.contact, p.dataset.summary);
      if (pFavKey === favKey || (legacyKey && pLegacy === legacyKey)) {
        const btn = p.querySelector(".st-cm-fav-btn");
        if (btn) {
          btn.classList.toggle("is-fav", isFavNow);
          btn.textContent = isFavNow ? "♥" : "♡";
        }
      }
    });

    renderFavoritesShelf();
  }

  // Быстрая отправка СМС из нижней строки телефона прямо в чат SillyTavern
  function handleQuickReply(phoneEl) {
    const input = phoneEl.querySelector(".st-cm-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const inChat = Boolean(phoneEl.closest("#chat"));
    if (inChat && isDomStreamingNow()) {
      if (window.toastr?.info) {
        window.toastr.info("Дождитесь завершения ответа персонажа перед отправкой СМС");
      }
      return;
    }

    const isOffline = Boolean(phoneEl.querySelector(".st-cm-online-ring.is-offline"));
    const body = phoneEl.querySelector(".st-cm-body");

    if (body) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const contactName = phoneEl.dataset.contact || "Собеседник";
      const existingCount = body.querySelectorAll(".st-cm-row").length;
      const msgKey = makeBubbleMsgKey(contactName, true, existingCount, text);
      const row = document.createElement("div");
      row.className = "st-cm-row is-user";
      row.innerHTML = `<div class="st-cm-bubble is-user" data-msg-key="${escapeHtml(msgKey)}" title="Нажми на сообщение, чтобы поставить реакцию">${renderBubbleContent(text)}<div class="st-cm-meta"><span>${hh}:${mm}</span><span class="st-cm-checks">${isOffline ? "✓" : "✓✓"}</span></div></div>`;
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
    }

    playSmsSound("outgoing");
    input.value = "";

    // Если это телефон внутри чата ST — отправляем (out) СМС в поле ввода SillyTavern
    if (inChat) {
      const stTextarea = document.getElementById("send_textarea");
      const stSendBtn = document.getElementById("send_but");
      if (stTextarea && stSendBtn) {
        const formatted = `(out) ${text}`;
        stTextarea.value = stTextarea.value.trim()
          ? `${stTextarea.value.trim()}\n${formatted}`
          : formatted;
        stTextarea.dispatchEvent(new Event("input", { bubbles: true }));
        stTextarea.dispatchEvent(new Event("change", { bubbles: true }));
        stSendBtn.click();
      }
    }
  }

  function saveBubbleReaction(msgKey, emoji) {
    if (!msgKey) return;
    const s = getSettings();
    if (!emoji) {
      delete s.reactions[msgKey];
    } else {
      s.reactions[msgKey] = emoji;
      const keys = Object.keys(s.reactions);
      if (keys.length > 500) {
        delete s.reactions[keys[0]];
      }
    }
    const ctx = window.SillyTavern?.getContext?.();
    ctx?.saveSettingsDebounced?.();
  }

  // ============================================================================
  // ОБРАБОТЧИКИ КЛИКОВ И НАЖАТИЙ
  // ============================================================================
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest?.(".st-cm-phone")) {
      unlockAudioEngine();
    }
  }, { passive: true });

  document.addEventListener("click", (e) => {
    const phone = e.target.closest?.(".st-cm-phone");
    if (!phone) return;

    // 1. Погладить котика в шапке
    const cat = e.target.closest(".st-cm-cat");
    if (cat) {
      e.stopPropagation();
      cat.classList.remove("is-purring");
      void cat.offsetWidth;
      cat.classList.add("is-purring");
      playCatPurr();
      return;
    }

    // 2. Проверить звук уведомления (🔔) без перезаписи настройки звука
    const soundBtn = e.target.closest(".st-cm-sound-btn");
    if (soundBtn) {
      e.stopPropagation();
      playSmsSound("incoming", true);
      return;
    }

    // 3. Сохранить переписку в избранное (♡ / ♥)
    const favBtn = e.target.closest(".st-cm-fav-btn");
    if (favBtn) {
      e.stopPropagation();
      toggleFavoritePhone(phone);
      playSmsSound("react");
      return;
    }

    // 4. Свернуть / развернуть телефон (– / +)
    const miniBtn = e.target.closest(".st-cm-mini-btn");
    if (miniBtn) {
      e.stopPropagation();
      const compact = phone.classList.toggle("is-compact");
      miniBtn.textContent = compact ? "+" : "–";
      return;
    }

    // 5. Прослушать голосовое сообщение (▶)
    const voiceEl = e.target.closest(".st-cm-voice");
    if (voiceEl) {
      e.stopPropagation();
      playSmsSound("voice");
      const playIcon = voiceEl.querySelector(".st-cm-voice-play");
      if (playIcon) {
        playIcon.textContent = "♫";
        setTimeout(() => { playIcon.textContent = "▶"; }, 1100);
      }
      return;
    }

    // 6. Кнопка отправки СМС (➤)
    const sendBtn = e.target.closest(".st-cm-send");
    if (sendBtn) {
      e.stopPropagation();
      handleQuickReply(phone);
      return;
    }

    // 7. Клик по пузырьку сообщения — ставит/меняет реакцию и сохраняет её
    const bubble = e.target.closest(".st-cm-bubble");
    if (bubble) {
      e.stopPropagation();
      let reactEl = bubble.querySelector(".st-cm-react");
      const currentEmoji = reactEl?.dataset?.emoji || "";
      const nextIdx = currentEmoji ? REACTIONS.indexOf(currentEmoji) + 1 : 0;
      const msgKey = bubble.dataset.msgKey || "";

      if (nextIdx >= REACTIONS.length) {
        if (reactEl) reactEl.remove();
        saveBubbleReaction(msgKey, "");
      } else {
        const nextEmoji = REACTIONS[nextIdx];
        if (!reactEl) {
          reactEl = document.createElement("div");
          reactEl.className = "st-cm-react";
          bubble.appendChild(reactEl);
        }
        reactEl.dataset.emoji = nextEmoji;
        reactEl.textContent = `${nextEmoji} 1`;
        saveBubbleReaction(msgKey, nextEmoji);
        playSmsSound("react");
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing && e.target.classList?.contains("st-cm-input")) {
      e.preventDefault();
      const phone = e.target.closest(".st-cm-phone");
      if (phone) handleQuickReply(phone);
    }
  });

  // ============================================================================
  // ПАНЕЛЬ НАСТРОЕК В МЕНЮ EXTENSIONS
  // ============================================================================
  const PREVIEW_TEMPLATE_HTML = `
    <p>(in) живот болит, зараза 😭</p>
    <p>(out) уже еду с таблетками</p>
    <p>(in) голосовое: 0:03</p>
    <p>(out) голосовое: 0:06</p>
  `;

  function refreshSettingsPreview() {
    const previewEl = document.getElementById("st_cm_preview");
    if (!previewEl) return;
    previewEl.innerHTML = PREVIEW_TEMPLATE_HTML;
    renderSmsInElement(previewEl, null, true);
  }

  function mountSettingsUi() {
    const container = document.getElementById("extensions_settings2") || document.getElementById("extensions_settings");
    if (!container || document.getElementById("st-cm-settings")) return;

    const s = getSettings();
    const isExtOn = s.extensionEnabled !== false;
    const vol = typeof s.volume === "number" ? s.volume : 0.4;

    const html = `
      <div id="st-cm-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>📱 Cozy Messenger <span id="st_cm_header_state" style="font-size:11px; font-weight:500; opacity:0.7;">${isExtOn ? "" : "(выкл.)"}</span></b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <button type="button" id="st_cm_power_btn" class="menu_button" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; margin:4px 0 10px; padding:8px 12px; font-weight:600; border-radius:10px; border:1px solid ${isExtOn ? "rgba(74, 222, 128, 0.45)" : "rgba(255, 255, 255, 0.18)"}; background:${isExtOn ? "rgba(74, 222, 128, 0.14)" : "rgba(255, 255, 255, 0.05)"};">
            <span id="st_cm_power_dot" style="width:9px; height:9px; border-radius:50%; background:${isExtOn ? "#4ade80" : "#94a3b8"}; box-shadow:${isExtOn ? "0 0 6px #4ade80" : "none"};"></span>
            <span id="st_cm_power_text">${isExtOn ? "Расширение включено — Выключить" : "Расширение выключено — Включить"}</span>
          </button>

          <div id="st_cm_subsettings" style="${isExtOn ? "" : "opacity:0.45; pointer-events:none;"} transition:opacity 0.2s ease;">
            <label class="checkbox_label"><input type="checkbox" id="st_cm_autoprompt" ${s.autoPrompt !== false ? "checked" : ""}><span>Авто-промпт для бота (строгий (in) / (out) без кавычек)</span></label>
            <label class="checkbox_label"><input type="checkbox" id="st_cm_sound" ${s.sound !== false ? "checked" : ""}><span>Звуки СМС, голосовых и мурчания котика</span></label>
            <label class="checkbox_label"><input type="checkbox" id="st_cm_mascot" ${s.cozyMascot !== false ? "checked" : ""}><span>🐾 Котик-маскот в шапке телефона</span></label>
            <label class="checkbox_label"><input type="checkbox" id="st_cm_footer" ${s.showFooter !== false ? "checked" : ""}><span>Строка быстрого ответа внизу экрана</span></label>
            <label class="checkbox_label"><input type="checkbox" id="st_cm_compact" ${s.compactMode ? "checked" : ""}><span>Компактный режим (мини-шапка)</span></label>

            <div style="margin-top:8px;">
              <label for="st_cm_volume">Громкость звуков: <span id="st_cm_vol_label">${Math.round(vol * 100)}%</span></label>
              <input type="range" id="st_cm_volume" min="0.05" max="1" step="0.05" value="${vol}" style="width:100%;">
            </div>

            <div style="margin-top:8px;">
              <label for="st_cm_theme">Тема телефона:</label>
              <select id="st_cm_theme" class="text_pole">
                <option value="glass" ${s.theme === "glass" ? "selected" : ""}>🧊 Liquid Glass (Матовое стекло)</option>
                <option value="noir" ${s.theme === "noir" ? "selected" : ""}>🍷 Velvet Noir (Тёмный бархат)</option>
                <option value="neon" ${s.theme === "neon" ? "selected" : ""}>📼 Retro Neon (Ночной неон)</option>
                <option value="dark" ${s.theme === "dark" ? "selected" : ""}>🌙 Midnight Lo-Fi (Ночной индиго)</option>
                <option value="latte" ${s.theme === "latte" ? "selected" : ""}>☕ Warm Latte (Тёплый латте)</option>
                <option value="pink" ${s.theme === "pink" ? "selected" : ""}>🌸 Sakura Pink (Нежная сакура)</option>
                <option value="matcha" ${s.theme === "matcha" ? "selected" : ""}>🍵 Cozy Matcha (Уютная матча)</option>
              </select>
            </div>

            <div id="st_cm_preview" style="margin-top:10px;">${PREVIEW_TEMPLATE_HTML}</div>

            <div class="st-cm-shelf-box">
              <div class="st-cm-shelf-header">
                <span>💌 Сохранённые переписки (<span id="st_cm_shelf_count">0</span>)</span>
              </div>
              <div id="st_cm_shelf_list"></div>
            </div>
          </div>
        </div>
      </div>`;

    container.insertAdjacentHTML("beforeend", html);
    refreshSettingsPreview();
    renderFavoritesShelf();

    const syncPowerUi = () => {
      const active = s.extensionEnabled !== false;
      const btn = document.getElementById("st_cm_power_btn");
      const dot = document.getElementById("st_cm_power_dot");
      const txt = document.getElementById("st_cm_power_text");
      const sub = document.getElementById("st_cm_subsettings");
      const hdr = document.getElementById("st_cm_header_state");
      if (btn) {
        btn.style.borderColor = active ? "rgba(74, 222, 128, 0.45)" : "rgba(255, 255, 255, 0.18)";
        btn.style.background = active ? "rgba(74, 222, 128, 0.14)" : "rgba(255, 255, 255, 0.05)";
      }
      if (dot) {
        dot.style.background = active ? "#4ade80" : "#94a3b8";
        dot.style.boxShadow = active ? "0 0 6px #4ade80" : "none";
      }
      if (txt) {
        txt.textContent = active ? "Расширение включено — Выключить" : "Расширение выключено — Включить";
      }
      if (sub) {
        sub.style.opacity = active ? "1" : "0.45";
        sub.style.pointerEvents = active ? "auto" : "none";
      }
      if (hdr) {
        hdr.textContent = active ? "" : "(выкл.)";
      }
    };

    const save = () => {
      const ctx = window.SillyTavern?.getContext?.();
      ctx?.saveSettingsDebounced?.();
      applyTheme();
      updatePrompt();
    };

    document.getElementById("st_cm_power_btn")?.addEventListener("click", () => {
      s.extensionEnabled = s.extensionEnabled === false;
      syncPowerUi();
      save();
      if (s.extensionEnabled === false) {
        restoreChatWidgets();
      } else {
        hasCompletedInitialScan = false;
        refreshSettingsPreview();
        scanChat();
      }
    });

    document.getElementById("st_cm_autoprompt")?.addEventListener("change", (e) => {
      s.autoPrompt = e.target.checked;
      save();
    });
    document.getElementById("st_cm_sound")?.addEventListener("change", (e) => {
      s.sound = e.target.checked;
      save();
    });
    document.getElementById("st_cm_mascot")?.addEventListener("change", (e) => {
      s.cozyMascot = e.target.checked;
      save();
    });
    document.getElementById("st_cm_footer")?.addEventListener("change", (e) => {
      s.showFooter = e.target.checked;
      save();
    });
    document.getElementById("st_cm_compact")?.addEventListener("change", (e) => {
      s.compactMode = e.target.checked;
      document.querySelectorAll(".st-cm-phone").forEach((p) => {
        p.classList.toggle("is-compact", s.compactMode);
        const btn = p.querySelector(".st-cm-mini-btn");
        if (btn) btn.textContent = s.compactMode ? "+" : "–";
      });
      save();
    });
    document.getElementById("st_cm_volume")?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      s.volume = isNaN(val) ? 0.4 : val;
      const lbl = document.getElementById("st_cm_vol_label");
      if (lbl) lbl.textContent = `${Math.round(s.volume * 100)}%`;
      save();
    });
    document.getElementById("st_cm_theme")?.addEventListener("change", (e) => {
      s.theme = e.target.value;
      save();
    });
  }

  let hooksRegistered = false;
  let mutationTimer = null;
  let chatObserver = null;

  function scheduleScan(delay = 120) {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(scanChat, delay);
  }

  function observeChatContainer() {
    const chat = document.getElementById("chat");
    if (!chat || chat.dataset.cmObserved === "1") return;
    chat.dataset.cmObserved = "1";

    if (chatObserver) {
      try { chatObserver.disconnect(); } catch (e) {}
    }

    chatObserver = new MutationObserver((mutations) => {
      if (getSettings().extensionEnabled === false) return;
      const externalChange = mutations.some((m) => {
        const targetEl = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        return targetEl && !targetEl.closest(".st-cm-phone");
      });
      if (!externalChange) return;
      scheduleScan(180);
    });

    chatObserver.observe(chat, { childList: true, subtree: true, characterData: true });
  }

  function registerTavernEvents() {
    if (hooksRegistered) return;
    const ctx = window.SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (!es || !et) return;

    hooksRegistered = true;

    const triggerScan = () => {
      scheduleScan(60);
      setTimeout(scanChat, 380);
    };

    if (et.CHAT_CHANGED) {
      es.on(et.CHAT_CHANGED, () => {
        hasCompletedInitialScan = false;
        notifiedMesSignatures.clear();
        updatePrompt();
        observeChatContainer();
        refreshSettingsPreview();
        triggerScan();
      });
    }

    if (et.GENERATION_STARTED) {
      es.on(et.GENERATION_STARTED, () => {
        updatePrompt();
      });
    }

    if (et.SETTINGS_LOADED) {
      es.on(et.SETTINGS_LOADED, () => {
        applyTheme();
        updatePrompt();
      });
    }

    [
      "GENERATION_ENDED",
      "GENERATION_STOPPED",
      "CHARACTER_MESSAGE_RENDERED",
      "USER_MESSAGE_RENDERED",
      "MESSAGE_RECEIVED",
      "MESSAGE_UPDATED",
      "MESSAGE_EDITED",
      "MESSAGE_SWIPED",
      "IMPERSONATE_READY",
      "MORE_MESSAGES_LOADED"
    ].forEach((name) => {
      if (et[name]) es.on(et[name], triggerScan);
    });
  }

  function initMessengerExtension() {
    updatePrompt();
    applyTheme();
    mountSettingsUi();
    registerTavernEvents();
    observeChatContainer();
    scanChat();
  }

  if (window.jQuery) {
    window.jQuery(() => initMessengerExtension());
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMessengerExtension, { once: true });
  } else {
    initMessengerExtension();
  }
  setTimeout(initMessengerExtension, 900);
})();

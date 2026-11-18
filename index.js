(() => {
  const EXT_NAME = "st-cozy-messenger";
  const PROMPT_KEY = "cozy_messenger_prompt";
  const DEFAULT_PROMPT = `When characters send or receive text messages (SMS/messenger) in the roleplay, write each phone message on a separate line using this exact prefix format:
(in) message from {{char}}
(out) message from {{user}}
For voice messages without text transcript, write:
(in) голосовое: 0:04
(out) голосовое: 0:06
Use (in) and (out) ONLY for phone messages, while keeping normal narrative and spoken dialogue as regular text.`;

  const defaultSettings = {
    enabled: true,
    autoWidget: false,
    sound: true,
    volume: 0.4,
    compactMode: false,
    cozyMascot: true,
    showFooter: true,
    theme: "glass",
    favorites: []
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

  const AUTO_SMS_MOODS = [
    {
      re: /недоступен|выключен|вне зоны|не в сети|не отвечал|сбросил|абонент|offline/i,
      status: "не в сети • недоступен",
      offline: true,
      followUp: "Абонент временно недоступен"
    },
    {
      re: /дожд|ливень|гроз|гром|зонт|туч|окн|капл|rain|storm/i,
      status: "в сети • 🌧️ онлайн",
      offline: false,
      followUp: "На улице такой ливень… Напиши, как доберёшься."
    },
    {
      re: /кофе|чай|какао|кружк|латте|кафе|таверн|камин|кост[её]р|плед|уют|coffee|tea|cozy|fire/i,
      status: "в сети • ☕ онлайн",
      offline: false,
      followUp: "Я взял нам кое-что горячее. Долго ещё будешь?"
    },
    {
      re: /ноч|лун|звезд|темнот|полноч|спать|сон|кроват|тишин|night|moon|sleep/i,
      status: "в сети • 🌙 не спит",
      offline: false,
      followUp: "Снова не спишь в такое время?"
    },
    {
      re: /губ|объяти|нежн|сердц|люб|поцел|щек|румян|ладон|тепл|палат|бинт|таблетк|болит|kiss|love|heart/i,
      status: "в сети • 💌 онлайн",
      offline: false,
      followUp: "голосовое: 0:04"
    },
    {
      re: /.*/,
      status: "в сети • онлайн",
      offline: false,
      followUp: "Ты где?"
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
    for (const k of Object.keys(defaultSettings)) {
      if (s[k] === undefined) s[k] = defaultSettings[k];
    }
    if (!Array.isArray(s.favorites)) s.favorites = [];
    return s;
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

  function cleanField(str = "") {
    return String(str)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hashText(str = "") {
    let h = 2166136261;
    const len = str.length;
    const step = Math.max(1, Math.floor(len / 200));
    for (let i = 0; i < len; i += step) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  // Получение реального имени и аватарки персонажа/игрока из SillyTavern
  function getTavernProfile(mesEl = null) {
    const ctx = window.SillyTavern?.getContext?.();
    let charName = ctx?.name2 || "Собеседник";
    let userName = ctx?.name1 || "Я";
    let charAvatar = "";
    let userAvatar = "";

    if (mesEl) {
      const chNameEl = mesEl.querySelector(".ch_name .name_text, .name_text");
      const isUserMes = mesEl.getAttribute("is_user") === "true";
      if (chNameEl && !isUserMes && chNameEl.textContent.trim()) {
        charName = chNameEl.textContent.trim();
      }
      const avImg = mesEl.querySelector(".avatar img");
      if (avImg && !isUserMes && avImg.getAttribute("src")) {
        charAvatar = avImg.getAttribute("src");
      }
    }

    if (!charAvatar) {
      const lastCharImg = document.querySelector('#chat .mes[is_user="false"] .avatar img');
      if (lastCharImg && lastCharImg.getAttribute("src")) {
        charAvatar = lastCharImg.getAttribute("src");
      } else if (ctx?.characters && ctx?.characterId !== undefined) {
        const c = ctx.characters[ctx.characterId];
        if (c?.avatar) {
          charAvatar = `/characters/${encodeURIComponent(c.avatar)}`;
        }
      }
    }

    const lastUserImg = document.querySelector('#chat .mes[is_user="true"] .avatar img');
    if (lastUserImg && lastUserImg.getAttribute("src")) {
      userAvatar = lastUserImg.getAttribute("src");
    }

    return {
      charName,
      userName,
      charAvatar: charAvatar || DEFAULT_CHAR_AVATAR,
      userAvatar: userAvatar || DEFAULT_CHAR_AVATAR
    };
  }

  function applyTheme() {
    const s = getSettings();
    document.body.classList.remove(...THEME_CLASSES);
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

  function updatePrompt() {
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx?.setExtensionPrompt) return;
    const { enabled } = getSettings();
    ctx.setExtensionPrompt(PROMPT_KEY, enabled ? DEFAULT_PROMPT : "", 1, 0);
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

  // 🔔 Звук уведомления СМС / смены реакции
  function playSmsSound(type = "incoming") {
    const s = getSettings();
    if (!s.sound) return;
    const ctx = unlockAudioEngine();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = getVolume() * 0.55;
    master.connect(ctx.destination);

    if (type === "incoming") {
      const notes = [587.33, 880.0]; // D5 -> A5 стеклянный колокольчик
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
      // 🎙️ Уютная Lo-Fi мелодия голосового сообщения
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
    if (!s.sound) return;
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
  // ПАРСИНГ СООБЩЕНИЙ (IN) / (OUT), ГОЛОСОВЫХ И СТИКЕРОВ (БЕЗ ТЯЖЁЛЫХ ФОТО)
  // ============================================================================
  function formatVoiceDuration(raw = "") {
    const clean = String(raw || "").trim();
    const timeMatch = clean.match(/(\d{1,2}:\d{2})/);
    if (timeMatch) return timeMatch[1];
    const secMatch = clean.match(/^(\d{1,2})\s*(?:с|сек|s|sec)?$/i);
    if (secMatch) {
      const s = Math.max(1, Math.min(59, parseInt(secMatch[1], 10)));
      return `0:${s < 10 ? "0" + s : s}`;
    }
    return "0:04";
  }

  function renderBubbleContent(rawMsg = "") {
    const trimmed = rawMsg.trim();

    // 1. Голосовое сообщение в стиле Telegram (без расшифровки):
    // голосовое: 0:03 | гс: 0:06 | voice: 0:12
    const voiceMatch = trimmed.match(
      /^\[?(?:голосовое(?:\s+сообщение)?|гс|голос|voice|аудио|audio)(?:\s*[:\-]\s*([\s\S]*?))?\]?$/i
    );
    if (voiceMatch) {
      const dur = escapeHtml(formatVoiceDuration(voiceMatch[1] || "0:04"));
      return `<div class="st-cm-voice" title="Нажми, чтобы прослушать голосовое"><div class="st-cm-voice-play">▶</div><div class="st-cm-voice-waves"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><span class="st-cm-voice-dur">${dur}</span></div>`;
    }

    // 2. Стикер: стикер: 🐾 или [стикер: 🐾]
    const stickerMatch = trimmed.match(/^\[?(?:стикер|sticker)\s*:\s*([\s\S]+?)\]?$/i);
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
      (u && s === u)
    );
  }

  function detectSceneStatus(contextText = "") {
    const matched = AUTO_SMS_MOODS.find((m) => m.re.test(contextText)) || AUTO_SMS_MOODS[AUTO_SMS_MOODS.length - 1];
    return {
      status: matched.status,
      offline: Boolean(matched.offline)
    };
  }

  // Парсинг содержимого тега [sms: ...] (также поддерживает (in) и (out) внутри)
  function parseSmsTagPayload(payload, profile, contextText = "") {
    const raw = String(payload || "").trim();
    const segments = raw.includes("|")
      ? raw.split("|").map((s) => s.trim()).filter(Boolean)
      : raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

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

    if (!/^\(\s*(?:in|out|вх|исх)\s*\)/i.test(first)) {
      if (!first.includes(":") || /^[^:]{1,28}$/.test(first)) {
        contactName = cleanField(first) || contactName;
        startIdx = 1;
        if (
          segments.length > 2 &&
          !/^\(\s*(?:in|out|вх|исх)\s*\)/i.test(segments[1]) &&
          (!segments[1].includes(":") || /в сети|онлайн|online|недоступен|выключен|печатает|typing|был|недавно|🌙|☕|🌧|✨|💌/i.test(segments[1]))
        ) {
          status = cleanField(segments[1]);
          offline = /недоступен|выключен|не в сети|offline/i.test(status);
          startIdx = 2;
        }
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
        const body = inOutMatch[2].trim();
        if (/^(?:печатает|typing|\.{3}|…)$/i.test(body) && !isOut) {
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

    if (messages.length === 0 && segments.length > 0) {
      messages.push({
        sender: contactName,
        isUser: false,
        text: segments[segments.length - 1]
      });
    }

    return { contactName, status, offline, messages, showTyping };
  }

  function makeFavKey(contact = "", firstText = "") {
    return `${String(contact).trim().toLowerCase()}|${String(firstText).trim().toLowerCase().slice(0, 60)}`;
  }

  function isChatFavorited(contact, firstText) {
    const s = getSettings();
    const key = makeFavKey(contact, firstText);
    return s.favorites.some((f) => makeFavKey(f.contactName, f.summary) === key);
  }

  function buildPhoneHtml(data, profile) {
    const s = getSettings();
    const contactName = cleanField(data.contactName || profile.charName || "Собеседник");
    const status = cleanField(data.status || "в сети • онлайн");
    const isOffline = Boolean(data.offline) || /недоступен|выключен|не в сети|offline/i.test(status);
    const messages = Array.isArray(data.messages) && data.messages.length > 0
      ? data.messages
      : [{ sender: contactName, isUser: false, text: "Ты где?" }];

    const firstSummary = cleanField(messages[0]?.text || "");
    const fav = isChatFavorited(contactName, firstSummary);
    const drinkIcon = THEME_DRINKS[s.theme] || "☕";
    const compactClass = s.compactMode ? "is-compact" : "";
    const charAvatar = escapeHtml(profile.charAvatar || DEFAULT_CHAR_AVATAR);

    const baseMinute = 18 + (hashText(contactName + firstSummary) % 38);

    const rowsHtml = messages
      .map((m, idx) => {
        const isUser = Boolean(m.isUser);
        const rowCls = isUser ? "is-user" : "is-char";
        const min = (baseMinute + idx) % 60;
        const timeStr = `22:${min < 10 ? "0" + min : min}`;
        const avatarHtml = !isUser
          ? `<img class="st-cm-mini-avatar" src="${charAvatar}" alt="av">`
          : "";
        const checksHtml = isUser ? `<span class="st-cm-checks">${isOffline ? "✓" : "✓✓"}</span>` : "";
        const bodyHtml = renderBubbleContent(m.text);

        return `<div class="st-cm-row ${rowCls}">${avatarHtml}<div class="st-cm-bubble ${rowCls}" title="Нажми на сообщение, чтобы поставить реакцию">${bodyHtml}<div class="st-cm-meta"><span>${timeStr}</span>${checksHtml}</div></div></div>`;
      })
      .join("");

    const typingHtml = data.showTyping
      ? `<div class="st-cm-typing" title="${escapeHtml(contactName)} печатает..."><span></span><span></span><span></span></div>`
      : "";

    const payloadJson = escapeHtml(
      JSON.stringify({
        contactName,
        status,
        offline: isOffline,
        summary: firstSummary,
        messages
      })
    );

    return `<div class="st-cm-phone ${compactClass}" data-contact="${escapeHtml(contactName)}" data-summary="${escapeHtml(firstSummary)}" data-payload="${payloadJson}">
      <div class="st-cm-statusbar">
        <span>22:${baseMinute < 10 ? "0" + baseMinute : baseMinute}</span>
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
          <span class="st-cm-sound-btn" title="Проиграть звук уведомления СМС">🔔</span>
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

  // Авто-генерация уютной СМС от персонажа по тексту ролевого поста
  function buildAutoSmsData(rawText, profile) {
    const clean = rawText
      .replace(/\[(?:sms|chat|msg|vinyl):[\s\S]*?\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const mood = AUTO_SMS_MOODS.find((m) => m.re.test(clean)) || AUTO_SMS_MOODS[AUTO_SMS_MOODS.length - 1];

    // Ищем прямую речь или яркое предложение из поста
    const quotes = clean.match(/[«"“]([^»"”]{12,120})[»"”]/);
    let quoteLine = "";
    if (quotes && quotes[1]) {
      quoteLine = quotes[1].trim();
    } else {
      const sentences = clean
        .split(/(?<=[.!?…])\s+/)
        .filter((s) => s.length >= 20 && s.length <= 125);
      quoteLine = sentences.length > 0
        ? sentences[sentences.length - 1]
        : clean.slice(0, 95) + (clean.length > 95 ? "…" : "");
    }

    const h = hashText(clean);
    const includePhoto = h % 2 === 0;

    const messages = [];
    if (includePhoto) {
      messages.push({
        sender: profile.charName,
        isUser: false,
        text: `[фото: ${mood.photoCaption}]`
      });
    }
    messages.push({
      sender: profile.charName,
      isUser: false,
      text: quoteLine
    });
    if (h % 3 === 0) {
      messages.push({
        sender: profile.charName,
        isUser: false,
        text: mood.followUp
      });
    }

    return {
      contactName: profile.charName,
      status: mood.status,
      messages,
      showTyping: false
    };
  }

  const SMS_TAG_REGEX = /\[(?:sms|chat|смс):\s*([\s\S]+?)\](?!\s*—)/gi;

  function renderSmsInElement(el, mesEl = null) {
    if (!el) return false;
    const html = el.innerHTML || "";
    const text = el.textContent || "";
    if (!/\[(?:sms|chat|смс):/i.test(html) && !/\[(?:sms|chat|смс):/i.test(text)) {
      return false;
    }

    const profile = getTavernProfile(mesEl);

    SMS_TAG_REGEX.lastIndex = 0;
    if (SMS_TAG_REGEX.test(html)) {
      SMS_TAG_REGEX.lastIndex = 0;
      el.innerHTML = html.replace(SMS_TAG_REGEX, (_, payload) => {
        const parsed = parseSmsTagPayload(cleanField(payload), profile);
        return buildPhoneHtml(parsed, profile);
      });
      return true;
    }

    SMS_TAG_REGEX.lastIndex = 0;
    if (SMS_TAG_REGEX.test(text)) {
      SMS_TAG_REGEX.lastIndex = 0;
      const match = SMS_TAG_REGEX.exec(text);
      if (match) {
        const [fullMatch, payload] = match;
        const parsed = parseSmsTagPayload(payload, profile);
        const phoneHtml = buildPhoneHtml(parsed, profile);
        el.innerHTML = html.replace(escapeHtml(fullMatch), phoneHtml);
        return true;
      }
    }
    return false;
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

  function scanChat() {
    if (isScanning) return;
    isScanning = true;

    try {
      const streaming = isDomStreamingNow();
      const settings = getSettings();
      const allMessages = Array.from(document.querySelectorAll("#chat .mes"));

      allMessages.forEach((mes, idx) => {
        const mesText = mes.querySelector(".mes_text");
        if (!mesText) return;

        const isLastMessage = idx === allMessages.length - 1;

        if (renderSmsInElement(mesText, mes) || mesText.querySelector(".st-cm-phone")) {
          const autoMount = mes.querySelector(".st-cm-auto-mount");
          if (autoMount) autoMount.remove();
          return;
        }

        const rawText = (mesText.innerText || "").trim();
        if (/\[(?:sms|chat|смс):[^\]]*$/i.test(rawText)) {
          const autoMount = mes.querySelector(".st-cm-auto-mount");
          if (autoMount) autoMount.remove();
          return;
        }

        if (streaming && isLastMessage) {
          const autoMount = mes.querySelector(".st-cm-auto-mount");
          if (autoMount) autoMount.remove();
          return;
        }

        const isUser = mes.getAttribute("is_user") === "true";
        const isSystem = mes.getAttribute("is_system") === "true";
        if (isUser || isSystem) return;

        let mount = mes.querySelector(".st-cm-auto-mount");
        if (settings.autoWidget === false) {
          if (mount) mount.remove();
          return;
        }

        if (rawText.length < 18) return;

        const swipeId = mes.getAttribute("swipeid") || "";
        const stateKey = `${rawText.length}:${hashText(rawText)}:${swipeId}`;
        if (mount && mount.dataset.stateKey === stateKey) return;

        const profile = getTavernProfile(mes);
        const autoData = buildAutoSmsData(rawText, profile);
        if (!mount) {
          mount = document.createElement("div");
          mount.className = "st-cm-auto-mount";
          mesText.insertAdjacentElement("afterend", mount);
        }
        mount.dataset.stateKey = stateKey;
        mount.innerHTML = buildPhoneHtml(autoData, profile);
      });
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

    const profile = getTavernProfile(null);
    listEl.innerHTML = favs
      .map((f) => buildPhoneHtml(f, profile))
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
    const key = makeFavKey(contactName, summary);
    const idx = s.favorites.findIndex((f) => makeFavKey(f.contactName, f.summary) === key);

    if (idx >= 0) {
      s.favorites.splice(idx, 1);
    } else {
      s.favorites.unshift(
        payload || {
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
      if (makeFavKey(p.dataset.contact, p.dataset.summary) === key) {
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

    const contactName = phoneEl.dataset.contact || "Собеседник";
    const body = phoneEl.querySelector(".st-cm-body");

    if (body) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const row = document.createElement("div");
      row.className = "st-cm-row is-user";
      row.innerHTML = `<div class="st-cm-bubble is-user" title="Нажми на сообщение, чтобы поставить реакцию">${renderBubbleContent(text)}<div class="st-cm-meta"><span>${hh}:${mm}</span><span class="st-cm-checks">✓✓</span></div></div>`;
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
    }

    playSmsSound("outgoing");
    input.value = "";

    // Если это телефон внутри чата ST — отправляем СМС в поле ввода SillyTavern
    if (phoneEl.closest("#chat")) {
      const stTextarea = document.getElementById("send_textarea");
      const stSendBtn = document.getElementById("send_but");
      if (stTextarea && stSendBtn) {
        const formatted = `[sms: ${contactName} | в сети 💌 | Я: ${text}]`;
        stTextarea.value = stTextarea.value
          ? `${stTextarea.value.trim()}\n${formatted}`
          : formatted;
        stTextarea.dispatchEvent(new Event("input", { bubbles: true }));
        stSendBtn.click();
      }
    }
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

    // 2. Звук уведомления (🔔)
    const soundBtn = e.target.closest(".st-cm-sound-btn");
    if (soundBtn) {
      e.stopPropagation();
      const s = getSettings();
      if (!s.sound) s.sound = true;
      playSmsSound("incoming");
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

    // 6. Кнопка 📸 (вставить шаблон Polaroid-фото в поле быстрого ответа)
    const photoBtn = e.target.closest(".st-cm-photo-btn");
    if (photoBtn) {
      e.stopPropagation();
      const input = phone.querySelector(".st-cm-input");
      if (input) {
        if (!input.value.includes("[фото:")) {
          input.value = `[фото: ${input.value || "Уютный кадр с телефона"}]`;
        }
        input.focus();
      }
      return;
    }

    // 7. Кнопка отправки СМС (➤)
    const sendBtn = e.target.closest(".st-cm-send");
    if (sendBtn) {
      e.stopPropagation();
      handleQuickReply(phone);
      return;
    }

    // 8. Клик по пузырьку сообщения — ставит/меняет реакцию (❤️ 🔥 🐾 🥺 ✨ 😂)
    const bubble = e.target.closest(".st-cm-bubble");
    if (bubble) {
      e.stopPropagation();
      let reactEl = bubble.querySelector(".st-cm-react");
      const currentEmoji = reactEl?.dataset?.emoji || "";
      const nextIdx = currentEmoji ? REACTIONS.indexOf(currentEmoji) + 1 : 0;

      if (nextIdx >= REACTIONS.length) {
        if (reactEl) reactEl.remove();
      } else {
        const nextEmoji = REACTIONS[nextIdx];
        if (!reactEl) {
          reactEl = document.createElement("div");
          reactEl.className = "st-cm-react";
          bubble.appendChild(reactEl);
        }
        reactEl.dataset.emoji = nextEmoji;
        reactEl.textContent = `${nextEmoji} 1`;
        playSmsSound("react");
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList?.contains("st-cm-input")) {
      e.preventDefault();
      const phone = e.target.closest(".st-cm-phone");
      if (phone) handleQuickReply(phone);
    }
  });

  // ============================================================================
  // ПАНЕЛЬ НАСТРОЕК В МЕНЮ EXTENSIONS
  // ============================================================================
  function mountSettingsUi() {
    const container = document.getElementById("extensions_settings2") || document.getElementById("extensions_settings");
    if (!container || document.getElementById("st-cm-settings")) return;

    const s = getSettings();

    const html = `
      <div id="st-cm-settings" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>📱 Cozy Messenger</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label class="checkbox_label"><input type="checkbox" id="st_cm_autowidget" ${s.autoWidget !== false ? "checked" : ""}><span>Авто-СМС под каждым ответом бота</span></label>
          <label class="checkbox_label"><input type="checkbox" id="st_cm_sound" ${s.sound !== false ? "checked" : ""}><span>Звуки СМС, голосовых и мурчания котика</span></label>
          <label class="checkbox_label"><input type="checkbox" id="st_cm_mascot" ${s.cozyMascot !== false ? "checked" : ""}><span>🐾 Котик-маскот в шапке телефона</span></label>
          <label class="checkbox_label"><input type="checkbox" id="st_cm_footer" ${s.showFooter !== false ? "checked" : ""}><span>Строка быстрого ответа внизу экрана</span></label>
          <label class="checkbox_label"><input type="checkbox" id="st_cm_compact" ${s.compactMode ? "checked" : ""}><span>Компактный режим (мини-шапка)</span></label>
          <label class="checkbox_label"><input type="checkbox" id="st_cm_enabled" ${s.enabled ? "checked" : ""}><span>Авто-промпт для бота (тег [sms: ...])</span></label>

          <div style="margin-top:8px;">
            <label for="st_cm_volume">Громкость звуков: <span id="st_cm_vol_label">${Math.round((typeof s.volume === "number" ? s.volume : 0.4) * 100)}%</span></label>
            <input type="range" id="st_cm_volume" min="0.05" max="1" step="0.05" value="${typeof s.volume === "number" ? s.volume : 0.4}" style="width:100%;">
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

          <div id="st_cm_preview" style="margin-top:10px;">
            [sms: Уютный Контакт | в сети • 🌧️ у окна | Привет! Нажми на сообщение для реакции ❤️, погладь котика в шапке или включи голосовое ниже 👇 | [фото: Горячий латте и капли дождя на стекле] | [гс: Всё работает! Можешь даже написать ответ в нижней строке.] | Я: Какая красота ✨]
          </div>

          <div class="st-cm-shelf-box">
            <div class="st-cm-shelf-header">
              <span>💌 Сохранённые переписки (<span id="st_cm_shelf_count">0</span>)</span>
            </div>
            <div id="st_cm_shelf_list"></div>
          </div>
        </div>
      </div>`;

    container.insertAdjacentHTML("beforeend", html);
    renderSmsInElement(document.getElementById("st_cm_preview"), null);
    renderFavoritesShelf();

    const save = () => {
      const ctx = window.SillyTavern?.getContext?.();
      ctx?.saveSettingsDebounced?.();
      applyTheme();
      updatePrompt();
    };

    document.getElementById("st_cm_autowidget")?.addEventListener("change", (e) => {
      s.autoWidget = e.target.checked;
      save();
      scanChat();
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
    document.getElementById("st_cm_enabled")?.addEventListener("change", (e) => {
      s.enabled = e.target.checked;
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
  function registerTavernEvents() {
    if (hooksRegistered) return;
    const ctx = window.SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (!es || !et) return;

    hooksRegistered = true;
    const triggerScan = () => {
      setTimeout(scanChat, 80);
      setTimeout(scanChat, 450);
      setTimeout(scanChat, 1200);
    };

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
      "CHAT_CHANGED",
      "MORE_MESSAGES_LOADED"
    ].forEach((name) => {
      if (et[name]) es.on(et[name], triggerScan);
    });
  }

  let mutationTimer = null;

  function initMessengerExtension() {
    applyTheme();
    updatePrompt();
    mountSettingsUi();
    registerTavernEvents();
    scanChat();

    const chat = document.getElementById("chat");
    if (chat && !chat.dataset.cmObserved) {
      chat.dataset.cmObserved = "1";
      new MutationObserver((mutations) => {
        const externalChange = mutations.some((m) => {
          const targetEl = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          return targetEl && !targetEl.closest(".st-cm-phone, .st-cm-auto-mount");
        });
        if (!externalChange) return;
        if (mutationTimer) clearTimeout(mutationTimer);
        mutationTimer = setTimeout(scanChat, 220);
      }).observe(chat, { childList: true, subtree: true, characterData: true });
    }
  }

  if (window.jQuery) {
    window.jQuery(() => initMessengerExtension());
  } else {
    initMessengerExtension();
  }
  setTimeout(initMessengerExtension, 800);
  setTimeout(initMessengerExtension, 2500);
  setInterval(scanChat, 1500);
})();

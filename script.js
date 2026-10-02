/* ================================================================
   PAGE START POSITION
   Always start/reload at the top before Hero initialization.
   ================================================================ */

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function resetPageToTop() {
  const root = document.documentElement;
  const body = document.body;

  /*
    Prevent a global `scroll-behavior: smooth` rule from animating
    the reset and briefly exposing a restored scroll position.
  */
  const previousRootScrollBehavior = root.style.scrollBehavior;

  root.style.scrollBehavior = "auto";

  window.scrollTo(0, 0);
  root.scrollTop = 0;

  if (body) {
    body.scrollTop = 0;
  }

  if (previousRootScrollBehavior) {
    root.style.scrollBehavior = previousRootScrollBehavior;
  } else {
    root.style.removeProperty("scroll-behavior");
  }
}

/*
  Run immediately, before the Hero reads the current scroll position.
*/
resetPageToTop();

/*
  Browsers may restore the previous scroll position after parsing,
  after resources load, or when restoring the page from bfcache.
  Reassert the top position at those lifecycle points.
*/
window.addEventListener(
  "load",
  () => {
    resetPageToTop();

    requestAnimationFrame(() => {
      resetPageToTop();

      requestAnimationFrame(resetPageToTop);
    });
  },
  { once: true },
);

window.addEventListener("pageshow", () => {
  resetPageToTop();

  requestAnimationFrame(resetPageToTop);
});

const canvas = document.querySelector("#product-canvas");
const heroVideo = document.querySelector("#hero-video");
let context = null;
const heroSequence = document.querySelector(".hero-sequence");
const heroSticky = document.querySelector(".hero-sticky");

const TECH_PHONE_MAX = 700;
const TECH_TABLET_MAX = 980;

/*
  HERO COMPOSITION CONTROLS

  These values are intentionally centralized so the visual framing can be
  adjusted without touching the render math.

  MidPhase:
  - normal scale is used around standard desktop aspect ratios
  - wide scale is reached progressively on ultrawide screens
  - X shift is relative to viewport width

  FinalPhase:
  - the whole source frame remains contained inside the viewport
*/

const HEADER_PRODUCT_REVEAL_START = 0.22;
const HEADER_PRODUCT_REVEAL_END = 0.3;


const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);


const headerProductName = document.querySelector(".site-header .header-product-name");
const introTagline = document.querySelector(".hero-copy--bottom");
const heroVignette = document.querySelector(".hero-vignette");
const heroVellure = document.querySelector(".hero-vellure");
const staticHeroIntroImage = document.querySelector(
  ".hero-static__scene--intro .hero-static__media img",
);
const midPhase = document.querySelector(".phase-mid");
const endPhase = document.querySelector(".phase-end");
const staticHeroScenes = Array.from(
  document.querySelectorAll("[data-static-hero-scene]"),
);

const features = document.querySelectorAll(".feature");

const featureVideoTriggers = document.querySelectorAll(
  ".feature[data-video-key], .mobile-feature[data-video-key]",
);

const videoModal = document.querySelector(".video-modal");
const videoModalTitle = document.querySelector(".video-modal__title");

const videoModalDescription = document.querySelector(
  ".video-modal__description",
);

const videoModalPlayer = document.querySelector(".video-modal__player");

const reveals = document.querySelectorAll(".reveal");
const techCarousel = document.querySelector("[data-tech-carousel]");
const leadForm = document.querySelector("#lead-form");

let currentVideoTime = -1;
let pendingVideoTime = null;
let animationStarted = false;
let heroSequenceCleanup = null;
let staticHeroObserver = null;
let staticHeaderProductNameCleanup = null;
let scienceCleanup = null;
let scienceModulePromise = null;

const desktopExperienceQuery = window.matchMedia("(min-width: 981px)");
const scienceExperienceQuery = window.matchMedia("(min-width: 0px)");
let scienceSyncVersion = 0;
let heroFailed = false;
let modalBackground = [];
let modalPreviousOverflow = "";
let modalVideoLoadRequestId = 0;

/*
  The last animation frame is reached early, then held while
  the Final Phase callouts finish entering.
*/
const framePhaseEnd = 0.64;

const FINAL_PHASE_START = 0.67;
const FINAL_FEATURE_STAGGER = 0.03;
const FINAL_FEATURE_FADE_DURATION = 0.065;

const DEFAULT_VIDEO_PLAYBACK_RATE = 1.0;

/*
  Each video has one playbackRate used everywhere:
  desktop/tablet modal + mobile inline showcase.

  1.0 = native video speed.
*/

/*
  Horizontal source coordinate for the visual center of the
  standing syringe body.

  If the exported final frame changes horizontally, adjust
  only this value.
*/
const FINAL_SYRINGE_BODY_X = 0.5;

/*
  Source bounds used in the INTRO composition.

  These describe the visible horizontal syringe within the
  full exported frame, including transparent space.
*/

/*
  Final Phase hotspot positions in SOURCE IMAGE SPACE.

  X shares the same center axis so all four play buttons remain
  aligned to the syringe body.

  Y is independent for each physical product detail.
*/
const FINAL_FEATURE_SOURCE_ANCHORS = {
  needle: {
    x: FINAL_SYRINGE_BODY_X,
    y: 0.2,
  },

  marking: {
    x: FINAL_SYRINGE_BODY_X,
    y: 0.35,
  },

  dosage: {
    x: FINAL_SYRINGE_BODY_X,
    y: 0.48,
  },

  support: {
    x: FINAL_SYRINGE_BODY_X,
    y: 0.65,
  },
};

let focusedFeature = null;
let lastFrameProgress = 0;
let sequenceRaf = null;

/*
  Cached CSS-pixel dimensions.

  These are refreshed on resize instead of forcing a canvas
  layout measurement during every scroll update.
*/
const heroCanvasSize = {
  width: Math.max(window.innerWidth, 1),
  height: Math.max(window.innerHeight, 1),
};


const videoCatalog = {
  needle: {
    title: "Agulhas Terumo 27G TW",
    description:
      "Cada apresentação já vem com duas agulhas Terumo de parede fina para uma aplicação mais precisa e fluxo de gel facilitado.",
    src: "videos/agulha.mp4",
    playbackRate: 0.6,
    scale: 1.5,
    mobileScale: 1.8,
  },

  marking: {
    title: "Marcação 0,05 mL",
    description:
      "Escala com leitura objetiva para controle visual da dosagem durante toda a aplicação.",
    src: "videos/rotulo.mp4",
    playbackRate: 0.3,
    scale: 1.0,
    mobileScale: 1.5,
  },

  dosage: {
    title: "Seringa em Vidro Premium",
    description:
      "Estrutura pensada para estabilidade e consistência de entrega ao longo do procedimento.",
    src: "videos/corpo_de_vidro.mp4",
    playbackRate: 0.45,
    scale: 1.0,
    mobileScale: 1.0,
  },

  support: {
    title: "Apoiador Ergonômico",
    description:
      "Favorece a estabilidade durante o manuseio, com deslize suave do êmbolo e extrusão uniforme do gel.",
    src: "videos/aplicador.mp4",
    playbackRate: 0.6,
    mobileScale: 1.0,
  },
};

/* ================================================================
   FINAL PHASE FEATURE ANCHORS
   ================================================================ */

function getSourceDimensions(source) {
  return {
    width: source?.videoWidth || source?.naturalWidth || 0,
    height: source?.videoHeight || source?.naturalHeight || 0,
  };
}

function updateFinalFeatureAnchors(image, drawX, drawY, drawWidth, drawHeight) {
  const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(image);
  if (!sourceWidth || !sourceHeight) return;

  features.forEach((feature) => {
    const point = FINAL_FEATURE_SOURCE_ANCHORS[feature.dataset.videoKey];
    if (!point) return;

    const renderX = drawX + point.x * drawWidth;
    const renderY = drawY + point.y * drawHeight;
    feature.style.setProperty("--feature-anchor-x", `${renderX}px`);
    feature.style.setProperty("--feature-anchor-y", `${renderY}px`);
  });
}
/* ================================================================
   STATIC FINAL FEATURE ANCHORS — 701–980
   ================================================================ */

function setupStaticFinalFeatureAnchors() {
  const stage = document.querySelector(".static-final-stage");

  const image = stage?.querySelector(".static-final-stage__image");

  const picture = stage?.querySelector(".static-final-stage__picture");

  const staticFeatures = Array.from(
    stage?.querySelectorAll(".static-final-feature[data-video-key]") || [],
  );

  if (!stage || !image || !picture || !staticFeatures.length) {
    return;
  }

  function update() {
    if (!image.naturalWidth || !image.naturalHeight) {
      return;
    }

    /*
      The picture can be offset and resized by responsive rules. Use its
      content box, then express the result in the stage coordinate system
      used by the absolutely positioned buttons.
    */
    const pictureLeft = picture.offsetLeft;

    const pictureTop = picture.offsetTop;

    const containerWidth = picture.clientWidth;

    const containerHeight = picture.clientHeight;

    if (!containerWidth || !containerHeight) {
      return;
    }

    /*
      The image is object-fit: contain.

      Calculate the exact rendered image rectangle inside the stage,
      then convert the desktop source-image anchors into CSS pixels
      relative to that rendered rectangle.
    */
    const imageAspect = image.naturalWidth / image.naturalHeight;

    const containerAspect = containerWidth / containerHeight;

    let drawWidth;
    let drawHeight;
    let drawX;
    let drawY;

    if (containerAspect > imageAspect) {
      drawHeight = containerHeight;
      drawWidth = drawHeight * imageAspect;
      drawX = (containerWidth - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = containerWidth;
      drawHeight = drawWidth / imageAspect;
      drawX = 0;
      drawY = (containerHeight - drawHeight) / 2;
    }

    staticFeatures.forEach((feature) => {
      const point = FINAL_FEATURE_SOURCE_ANCHORS[feature.dataset.videoKey];

      if (!point) {
        return;
      }

      const x = pictureLeft + drawX + point.x * drawWidth;

      const y = pictureTop + drawY + point.y * drawHeight;

      feature.style.setProperty("--static-feature-x", `${x}px`);

      feature.style.setProperty("--static-feature-y", `${y}px`);
    });

    stage.style.setProperty("--static-image-left", `${drawX}px`);

    stage.style.setProperty("--static-image-top", `${drawY}px`);

    stage.style.setProperty("--static-image-width", `${drawWidth}px`);

    stage.style.setProperty("--static-image-height", `${drawHeight}px`);
  }

  if (image.complete) {
    update();
  } else {
    image.addEventListener("load", update, { once: true });
  }

  const resizeObserver =
    "ResizeObserver" in window ? new ResizeObserver(update) : null;

  resizeObserver?.observe(stage);

  window.addEventListener("resize", update, { passive: true });

  window.addEventListener("pageshow", update, { passive: true });

  requestAnimationFrame(update);
}

/* ================================================================
   HERO VIDEO SCRUBBING
   ================================================================ */

const HERO_VIDEO_SEEK_EPSILON = 1 / 120;

function getHeroVideoDuration() {
  const duration = Number(heroVideo?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function drawCurrentHeroVideoFrame() {
  const duration = getHeroVideoDuration();
  if (!duration || !heroVideo) return;
  currentVideoTime = heroVideo.currentTime;
  drawHeroVideo();
}

function commitHeroVideoSeek() {
  if (!heroVideo || heroVideo.seeking || pendingVideoTime === null) return;
  const duration = getHeroVideoDuration();
  if (!duration) return;

  const targetTime = Math.min(
    Math.max(pendingVideoTime, 0),
    Math.max(duration - 0.001, 0),
  );
  pendingVideoTime = null;

  if (Math.abs(heroVideo.currentTime - targetTime) < HERO_VIDEO_SEEK_EPSILON) {
    currentVideoTime = targetTime;
    drawHeroVideo();
    return;
  }

  try {
    heroVideo.currentTime = targetTime;
  } catch {
    activateHeroFallback();
  }
}

function requestHeroVideoProgress(progress) {
  const duration = getHeroVideoDuration();
  if (!heroVideo || !duration || heroVideo.readyState < 2) return;
  pendingVideoTime = clamp(progress) * duration;
  commitHeroVideoSeek();
}

function handleHeroVideoSeeked() {
  drawCurrentHeroVideoFrame();
  commitHeroVideoSeek();
}
/* ================================================================
   VIDEO MODAL
   ================================================================ */

/*
  VIDEO ASSET VERSIONING — PRODUCTION MODE

  Video files keep stable source filenames:
    videos/agulha.webm
    videos/rotulo.webm
    videos/corpo_de_vidro.webm
    videos/aplicador.webm

  The site automatically resolves a stable version token from the server
  metadata before the first playback in each page session.

  Priority:
  1. ETag
  2. Last-Modified + Content-Length
  3. Content-Length
  4. stable unversioned URL as a fallback

  The actual video is then loaded normally by <video>, so browsers and CDNs
  can cache it efficiently. The token changes only when the server reports
  that the underlying file changed.
*/
const resolvedVideoUrlPromises = new Map();

function sanitizeVideoVersionToken(value) {
  return String(value || "")
    .trim()
    .replace(/^W\//, "")
    .replace(/^"+|"+$/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function resolveVersionedVideoUrl(path) {
  if (!path) {
    return "";
  }

  if (resolvedVideoUrlPromises.has(path)) {
    return resolvedVideoUrlPromises.get(path);
  }

  const resolutionPromise = (async () => {
    const absoluteUrl = new URL(encodeURI(path), document.baseURI);

    try {
      const response = await fetch(absoluteUrl.href, {
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`Video metadata request failed: ${response.status}`);
      }

      const etag = response.headers.get("ETag");

      const lastModified = response.headers.get("Last-Modified");

      const contentLength = response.headers.get("Content-Length");

      const metadataToken =
        etag ||
        [lastModified, contentLength].filter(Boolean).join("-") ||
        contentLength ||
        "";

      const version = sanitizeVideoVersionToken(metadataToken);

      if (version) {
        absoluteUrl.searchParams.set("asset", version);
      }

      return absoluteUrl.href;
    } catch (error) {
      console.warn(
        "Unable to resolve automatic video asset version; using the stable source URL.",
        error,
      );

      return absoluteUrl.href;
    }
  })();

  resolvedVideoUrlPromises.set(path, resolutionPromise);

  return resolutionPromise;
}

window.addEventListener("pageshow", (event) => {
  /*
      A normal reload should re-check server metadata. A bfcache restore can
      safely keep the already-resolved URLs because the page itself was not
      re-requested.
    */
  if (!event.persisted) {
    resolvedVideoUrlPromises.clear();
  }
});

function getVideoScale(key, mode = "desktop") {
  const video = videoCatalog[key];

  if (!video) {
    return 1;
  }

  const preferredScale = mode === "mobile" ? video.mobileScale : video.scale;

  const fallbackScale = video.scale;

  const scale = Number(preferredScale ?? fallbackScale ?? 1);

  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function applyVideoScale(player, key, mode = "desktop") {
  if (!player) {
    return;
  }

  const scale = getVideoScale(key, mode);

  player.style.setProperty("--video-scale", String(scale));

  /*
    The mobile showcase has several historical responsive rules.
    Apply its transform inline with !important so the catalog control
    is always authoritative there.
  */
  if (mode === "mobile") {
    player.style.setProperty("transform", `scale(${scale})`, "important");

    player.style.setProperty("transform-origin", "center center", "important");
  } else {
    player.style.removeProperty("transform");

    player.style.removeProperty("transform-origin");
  }
}

function getVideoPlaybackRate(key) {
  const video = videoCatalog[key];

  if (!video) {
    return DEFAULT_VIDEO_PLAYBACK_RATE;
  }

  return Number.isFinite(video.playbackRate)
    ? video.playbackRate
    : DEFAULT_VIDEO_PLAYBACK_RATE;
}

function applyVideoSpeed(player, key) {
  if (!player) {
    return;
  }

  const rate = getVideoPlaybackRate(key);

  player.defaultPlaybackRate = rate;

  player.playbackRate = rate;
}

/* ================================================================
   NATIVE VIDEO CONTROLS — HARD DISABLE
   ================================================================ */

function hardDisableNativeVideoControls(player) {
  if (!player) {
    return;
  }

  const removeControls = () => {
    if (player.controls) {
      player.controls = false;
    }

    if (player.hasAttribute("controls")) {
      player.removeAttribute("controls");
    }

    player.setAttribute(
      "controlslist",
      "nodownload nofullscreen noremoteplayback",
    );

    player.disablePictureInPicture = true;
  };

  removeControls();

  [
    "loadedmetadata",
    "loadeddata",
    "canplay",
    "play",
    "pause",
    "emptied",
  ].forEach((eventName) => {
    player.addEventListener(eventName, removeControls, { passive: true });
  });

  const controlsObserver = new MutationObserver(() => {
    removeControls();
  });

  controlsObserver.observe(player, {
    attributes: true,
    attributeFilter: ["controls"],
  });
}

function setupInteractiveVideoPlayback(player) {
  if (!player || player.dataset.interactivePlaybackReady === "true") {
    return;
  }

  player.dataset.interactivePlaybackReady = "true";

  const HOLD_DELAY = 220;

  let holdTimer = null;
  let holdActive = false;
  let resumeAfterHold = false;
  let suppressClickUntil = 0;

  const clearHoldTimer = () => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const safePlay = () => {
    const playPromise = player.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  };

  const finishHold = () => {
    clearHoldTimer();

    if (!holdActive) {
      return;
    }

    holdActive = false;
    suppressClickUntil = performance.now() + 360;

    player.classList.remove("is-hold-paused");

    if (resumeAfterHold && !player.ended) {
      safePlay();
    }

    resumeAfterHold = false;
  };

  player.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }

      clearHoldTimer();
      holdActive = false;
      resumeAfterHold = false;

      holdTimer = window.setTimeout(() => {
        holdTimer = null;

        if (player.paused || player.ended) {
          return;
        }

        resumeAfterHold = true;
        holdActive = true;

        player.pause();

        player.classList.add("is-hold-paused");
      }, HOLD_DELAY);
    },
    { passive: true },
  );

  player.addEventListener("pointerup", finishHold, { passive: true });

  player.addEventListener("pointercancel", finishHold, { passive: true });

  player.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        finishHold();
      }
    },
    { passive: true },
  );

  player.addEventListener("click", (event) => {
    /*
        The click generated after a completed long-press must not toggle
        the player again.
      */
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const reachedEnd =
      player.ended ||
      (Number.isFinite(player.duration) &&
        player.duration > 0 &&
        player.currentTime >= player.duration - 0.08);

    if (reachedEnd) {
      event.preventDefault();

      player.currentTime = 0;
      safePlay();
      return;
    }

    /*
        A normal tap also resumes a player that was paused through
        native controls. While already playing, a tap is left alone so
        playback remains uninterrupted.
      */
    if (player.paused) {
      event.preventDefault();
      safePlay();
    }
  });

  player.addEventListener("ended", () => {
    player.classList.remove("is-hold-paused");
  });
}

async function openVideoModal(key, triggerElement) {
  const selectedVideo = videoCatalog[key];

  if (!selectedVideo || !videoModal || !videoModalPlayer) {
    return;
  }

  focusedFeature = triggerElement || null;

  videoModalTitle.textContent = selectedVideo.title;

  videoModalDescription.textContent = selectedVideo.description;

  const loadRequestId = ++modalVideoLoadRequestId;

  if (selectedVideo.src) {
    videoModalPlayer.pause();
    videoModalPlayer.removeAttribute("src");
    videoModalPlayer.load();

    videoModalPlayer.dataset.primarySrc = selectedVideo.src;

    videoModalPlayer.dataset.fallbackApplied = "false";

    videoModalPlayer.style.display = "block";
  } else {
    videoModalPlayer.removeAttribute("src");

    videoModalPlayer.removeAttribute("data-primary-src");

    videoModalPlayer.dataset.fallbackApplied = "false";

    videoModalPlayer.style.display = "none";
  }

  hardDisableNativeVideoControls(videoModalPlayer);
  videoModalPlayer.loop = false;
  videoModalPlayer.muted = true;

  videoModalPlayer.dataset.videoKey = key;

  applyVideoSpeed(videoModalPlayer, key);

  applyVideoScale(videoModalPlayer, key, "desktop");

  if (!videoModal.classList.contains("is-open")) {
    modalPreviousOverflow = document.body.style.overflow;
    modalBackground = Array.from(document.body.children)
      .filter(
        (element) => element !== videoModal && element instanceof HTMLElement,
      )
      .map((element) => ({ element, inert: element.inert }));
    modalBackground.forEach(({ element }) => {
      element.inert = true;
    });
  }
  videoModal.inert = false;
  videoModal.classList.add("is-open");

  videoModal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
  videoModal
    .querySelector(".video-modal__close")
    ?.focus({ preventScroll: true });

  if (selectedVideo.src) {
    const resolvedSrc = await resolveVersionedVideoUrl(selectedVideo.src);

    if (
      loadRequestId !== modalVideoLoadRequestId ||
      !videoModal.classList.contains("is-open")
    ) {
      return;
    }

    videoModalPlayer.src = resolvedSrc;

    videoModalPlayer.currentTime = 0;
    videoModalPlayer.load();

    videoModalPlayer.play().catch(() => {});
  }
}

function closeVideoModal() {
  modalVideoLoadRequestId += 1;
  if (!videoModal || !videoModalPlayer) {
    return;
  }

  videoModal.classList.remove("is-open");

  videoModal.setAttribute("aria-hidden", "true");

  videoModalPlayer.pause();

  videoModalPlayer.removeAttribute("src");

  videoModalPlayer.style.display = "block";

  videoModalPlayer.load();

  videoModal.inert = true;
  modalBackground.forEach(({ element, inert }) => {
    element.inert = inert;
  });
  modalBackground = [];
  document.body.style.overflow = modalPreviousOverflow;

  if (focusedFeature) {
    focusedFeature.focus();
  }
}

hardDisableNativeVideoControls(videoModalPlayer);

setupInteractiveVideoPlayback(videoModalPlayer);

videoModalPlayer?.addEventListener("loadedmetadata", () => {
  videoModalPlayer.muted = true;

  applyVideoSpeed(videoModalPlayer, videoModalPlayer.dataset.videoKey);

  videoModalPlayer.play().catch(() => {});
});

videoModalPlayer?.addEventListener("error", () => {
  videoModalDescription.textContent =
    "Não foi possível carregar este vídeo no momento.";
});

videoModal?.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !videoModal.classList.contains("is-open")) return;
  const focusable = Array.from(
    videoModal.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), video[controls], [tabindex="0"]',
    ),
  ).filter((element) => element.getClientRects().length);
  const first = focusable[0] || videoModal;
  const last = focusable[focusable.length - 1] || videoModal;
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === videoModal)
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

featureVideoTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    openVideoModal(trigger.dataset.videoKey, trigger);
  });
});

if (videoModal) {
  videoModal.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeModal === "true") {
      closeVideoModal();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && videoModal?.classList.contains("is-open")) {
    closeVideoModal();
  }
});

/* ================================================================
   CONTACT FORM
   ================================================================ */

leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (leadForm.dataset.submitting === "true") return;
  const status = leadForm.querySelector(".lead-form__status");
  const endpoint = leadForm.dataset.endpoint?.trim();
  if (!endpoint) {
    status.textContent =
      "O envio está temporariamente indisponível. Seus dados não foram enviados. Tente novamente mais tarde.";
    return;
  }
  const button = leadForm.querySelector('[type="submit"]');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  leadForm.dataset.submitting = "true";
  leadForm.setAttribute("aria-busy", "true");
  button.disabled = true;
  status.textContent = "Enviando...";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: new FormData(leadForm),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
    status.textContent = "Obrigado. Nossa equipe entrará em contato em breve.";
    leadForm.reset();
  } catch (error) {
    status.textContent =
      "Não foi possível enviar. Seus dados foram mantidos para uma nova tentativa.";
  } finally {
    clearTimeout(timeout);
    delete leadForm.dataset.submitting;
    leadForm.removeAttribute("aria-busy");
    button.disabled = false;
  }
});

/* ================================================================
   TECHNICAL CAROUSEL
   ================================================================ */

function setupTechCarousel() {
  if (!techCarousel) {
    return;
  }

  const track = techCarousel.querySelector(".tech-track");

  const previousButton = techCarousel.querySelector(".tech-nav--prev");

  const nextButton = techCarousel.querySelector(".tech-nav--next");

  const dots = Array.from(
    document.querySelectorAll(".tech-dots [data-tech-dot]"),
  );

  const slides = Array.from(track?.querySelectorAll(".tech-card") || []);

  const dotsContainer = document.querySelector(".tech-dots");
  const autoplayToggle = dotsContainer?.querySelector(".tech-autoplay-toggle");
  const TECH_AUTOPLAY_DURATION = 5000;
  if (
    !track ||
    !slides.length ||
    !dotsContainer ||
    dots.length !== slides.length
  )
    return;

  let currentIndex = 0;
  let dragStartX = 0;
  let dragPointerId = null;
  let dragLastX = 0;
  let dragLastTime = 0;
  let dragVelocityX = 0;
  let dragMoved = false;

  let carouselVisible = false;
  let interactionPaused = false;
  let lightboxPaused = false;
  let userPaused = prefersReducedMotion.matches;
  let progressAnimations = [];

  function getTechProfile() {
    const width = window.innerWidth;

    if (width <= TECH_PHONE_MAX) {
      return "phone";
    }

    if (width <= TECH_TABLET_MAX) {
      return "tablet";
    }

    return "desktop";
  }

  function applySlide(index) {
    const previousActiveIndex = currentIndex;

    currentIndex = (index + slides.length) % slides.length;

    techCarousel.dataset.direction =
      currentIndex === previousActiveIndex
        ? "idle"
        : (index - previousActiveIndex + slides.length) % slides.length <
            slides.length / 2
          ? "next"
          : "prev";

    const profile = getTechProfile();

    techCarousel.dataset.profile = profile;

    const nextIndex = (currentIndex + 1) % slides.length;

    const previousIndex = (currentIndex - 1 + slides.length) % slides.length;

    const farNextIndex = (currentIndex + 2) % slides.length;

    const farPreviousIndex = (currentIndex - 2 + slides.length) % slides.length;

    /*
      Phone and tablet show only the
      current card.

      Desktop keeps the neighboring
      coverflow cards.
    */
    const showNeighborCards = profile === "desktop" || profile === "phone";

    slides.forEach((slide, slideIndex) => {
      slide.inert = slideIndex !== currentIndex;
      slide.setAttribute("aria-hidden", String(slideIndex !== currentIndex));
      slide.classList.remove(
        "is-active",
        "is-next",
        "is-prev",
        "is-far-next",
        "is-far-prev",
      );

      if (slideIndex === currentIndex) {
        slide.classList.add("is-active");
      } else if (showNeighborCards && slideIndex === nextIndex) {
        slide.classList.add("is-next");
      } else if (showNeighborCards && slideIndex === previousIndex) {
        slide.classList.add("is-prev");
      } else if (showNeighborCards && slideIndex === farNextIndex) {
        slide.classList.add("is-far-next");
      } else if (showNeighborCards && slideIndex === farPreviousIndex) {
        slide.classList.add("is-far-prev");
      }
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === currentIndex);

      dot.setAttribute(
        "aria-current",
        dotIndex === currentIndex ? "true" : "false",
      );
    });

    resetAutoplayCycle();
  }

  function cancelProgressAnimation() {
    progressAnimations.forEach((animation) => {
      animation.onfinish = null;
      animation.cancel();
    });

    progressAnimations = [];
  }

  function resetProgressVisuals() {
    dots.forEach((dot) => {
      const progress = dot.querySelector(".tech-dot-progress");
      const body = progress?.querySelector(".tech-dot-progress__body");
      const cap = progress?.querySelector(".tech-dot-progress__cap");

      if (body) {
        body.style.transform = "scaleX(0)";
      }

      if (cap) {
        cap.style.transform = "translate3d(0, 0, 0)";
      }
    });
  }

  function updateAutoplayToggle() {
    if (!autoplayToggle) return;

    const state = userPaused ? "paused" : "playing";
    const label = userPaused ? "Reproduzir carrossel" : "Pausar carrossel";

    autoplayToggle.dataset.state = state;
    autoplayToggle.setAttribute("aria-label", label);
    autoplayToggle.setAttribute("title", label);
  }

  function canAutoplay() {
    return (
      carouselVisible &&
      !interactionPaused &&
      !lightboxPaused &&
      !userPaused &&
      !prefersReducedMotion.matches &&
      !document.hidden
    );
  }

  function getProgressDistance() {
    const cssDistance = parseFloat(
      getComputedStyle(dotsContainer).getPropertyValue(
        "--tech-progress-distance",
      ),
    );

    return Number.isFinite(cssDistance) ? cssDistance : 26;
  }

  function createProgressAnimation() {
    cancelProgressAnimation();
    resetProgressVisuals();

    if (!canAutoplay()) {
      updateAutoplayToggle();
      return;
    }

    const activeDot = dots[currentIndex];
    const progress = activeDot?.querySelector(".tech-dot-progress");
    const body = progress?.querySelector(".tech-dot-progress__body");
    const cap = progress?.querySelector(".tech-dot-progress__cap");

    if (!body || !cap) {
      updateAutoplayToggle();
      return;
    }

    const distance = getProgressDistance();

    const animationOptions = {
      duration: TECH_AUTOPLAY_DURATION,
      easing: "linear",
      fill: "forwards",
    };

    const bodyAnimation = body.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      animationOptions,
    );

    const capAnimation = cap.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(${distance}px, 0, 0)` },
      ],
      animationOptions,
    );

    capAnimation.onfinish = () => {
      progressAnimations = [];
      applySlide(currentIndex + 1);
    };

    progressAnimations = [bodyAnimation, capAnimation];

    updateAutoplayToggle();
  }

  function syncAutoplayState() {
    updateAutoplayToggle();

    if (!canAutoplay()) {
      progressAnimations.forEach((animation) => {
        animation.pause();
      });

      return;
    }

    if (progressAnimations.length) {
      progressAnimations.forEach((animation) => {
        animation.play();
      });

      return;
    }

    createProgressAnimation();
  }

  function resetAutoplayCycle() {
    createProgressAnimation();
  }

  previousButton?.addEventListener("click", () => {
    applySlide(currentIndex - 1);
  });

  nextButton?.addEventListener("click", () => {
    applySlide(currentIndex + 1);
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      applySlide(Number(dot.dataset.techDot || 0));
    });
  });

  function getPhoneDragCards() {
    return {
      active: track.querySelector(".tech-card.is-active"),
      previous: track.querySelector(".tech-card.is-prev"),
      next: track.querySelector(".tech-card.is-next"),
    };
  }

  function setImportantTransform(element, transform) {
    if (!element) return;

    element.style.setProperty("transform", transform, "important");
  }

  function setImportantOpacity(element, opacity) {
    if (!element) return;

    element.style.setProperty("opacity", String(opacity), "important");
  }

  function clearLiveDragStyles() {
    const cards = getPhoneDragCards();

    [cards.active, cards.previous, cards.next].forEach((card) => {
      if (!card) return;

      card.style.removeProperty("transform");

      card.style.removeProperty("opacity");

      card.style.removeProperty("filter");
    });
  }

  function renderPhoneLiveDrag(deltaX) {
    if (getTechProfile() !== "phone") {
      return;
    }

    const { active, previous, next } = getPhoneDragCards();

    if (!active) {
      return;
    }

    const cardWidth = active.getBoundingClientRect().width || 1;

    /*
      Let the card track the pointer 1:1, but soften excessive
      over-drag so it never flies completely away from the user.
    */
    const maxDrag = cardWidth * 1.08;

    const clampedDelta = Math.max(-maxDrag, Math.min(deltaX, maxDrag));

    const progress = Math.min(Math.abs(clampedDelta) / cardWidth, 1);

    const viewportWidth = window.innerWidth;

    /*
      Mirrors the CSS neighbour position used by the phone carousel.
      Because every card receives the same pointer delta, they behave
      like one physical horizontal strip.
    */
    const neighbourOffset = viewportWidth * 0.73;

    const activeScale = 1 - progress * 0.035;

    setImportantTransform(
      active,
      `translate3d(calc(-50% + ${clampedDelta}px), 0, 0) scale(${activeScale})`,
    );

    /*
      Drag left -> next card approaches.
      Drag right -> previous card approaches.
    */
    if (next) {
      const nextScale =
        clampedDelta < 0 ? 0.91 + progress * 0.09 : 0.91 - progress * 0.025;

      const nextOpacity =
        clampedDelta < 0
          ? 0.44 + progress * 0.56
          : Math.max(0.16, 0.44 - progress * 0.28);

      setImportantTransform(
        next,
        `translate3d(calc(-50% + ${neighbourOffset}px + ${clampedDelta}px), 8px, 0) scale(${nextScale})`,
      );

      setImportantOpacity(next, nextOpacity);
    }

    if (previous) {
      const previousScale =
        clampedDelta > 0 ? 0.91 + progress * 0.09 : 0.91 - progress * 0.025;

      const previousOpacity =
        clampedDelta > 0
          ? 0.44 + progress * 0.56
          : Math.max(0.16, 0.44 - progress * 0.28);

      setImportantTransform(
        previous,
        `translate3d(calc(-50% - ${neighbourOffset}px + ${clampedDelta}px), 8px, 0) scale(${previousScale})`,
      );

      setImportantOpacity(previous, previousOpacity);
    }
  }

  function finishPhoneLiveDrag(event, cancelled = false) {
    if (
      dragPointerId === null ||
      (event && dragPointerId !== event.pointerId)
    ) {
      return;
    }

    const pointerId = dragPointerId;

    const deltaX = event ? event.clientX - dragStartX : 0;

    const activeCard = track.querySelector(".tech-card.is-active");

    const cardWidth = activeCard?.getBoundingClientRect().width || 1;

    const distanceProgress = Math.abs(deltaX) / cardWidth;

    /*
      A slow drag commits after ~22% of one card.
      A quick flick can commit earlier.
    */
    const shouldCommit =
      !cancelled &&
      (distanceProgress >= 0.22 || Math.abs(dragVelocityX) >= 0.42);

    const direction = deltaX < 0 ? 1 : -1;

    dragPointerId = null;
    dragMoved = false;

    try {
      track.releasePointerCapture?.(pointerId);
    } catch (_) {}

    if (shouldCommit) {
      /*
        Change classes while the live inline positions are still
        present. On the following frame, remove the inline transforms
        and let CSS smoothly settle everything into its new slot.
      */
      applySlide(currentIndex + direction);

      requestAnimationFrame(() => {
        track.classList.remove("is-live-dragging");

        clearLiveDragStyles();

        interactionPaused = false;

        syncAutoplayState();
      });

      return;
    }

    track.classList.remove("is-live-dragging");

    clearLiveDragStyles();

    interactionPaused = false;

    syncAutoplayState();
  }

  track.addEventListener("pointerdown", (event) => {
    /*
        Only the phone experience uses live drag. Desktop/tablet keep
        their existing interaction models.
      */
    if (getTechProfile() !== "phone") {
      return;
    }

    /*
        Interactive elements keep their own pointer behavior.
      */
    if (event.target.closest("details, summary, button, a, input, textarea")) {
      return;
    }

    dragStartX = event.clientX;

    dragLastX = event.clientX;

    dragLastTime = performance.now();

    dragVelocityX = 0;
    dragMoved = false;

    dragPointerId = event.pointerId;

    interactionPaused = true;

    syncAutoplayState();

    track.classList.add("is-live-dragging");

    track.setPointerCapture?.(event.pointerId);
  });

  track.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId || getTechProfile() !== "phone") {
      return;
    }

    const deltaX = event.clientX - dragStartX;

    if (Math.abs(deltaX) > 3) {
      dragMoved = true;
    }

    const now = performance.now();

    const elapsed = Math.max(now - dragLastTime, 1);

    /*
        Smoothed instantaneous velocity in px/ms.
      */
    const instantaneousVelocity = (event.clientX - dragLastX) / elapsed;

    dragVelocityX = dragVelocityX * 0.72 + instantaneousVelocity * 0.28;

    dragLastX = event.clientX;

    dragLastTime = now;

    renderPhoneLiveDrag(deltaX);
  });

  track.addEventListener("pointerup", (event) => {
    finishPhoneLiveDrag(event, false);
  });

  track.addEventListener("pointercancel", (event) => {
    finishPhoneLiveDrag(event, true);
  });

  techCarousel.addEventListener("pointerenter", () => {
    interactionPaused = true;
    syncAutoplayState();
  });

  techCarousel.addEventListener("pointerleave", () => {
    interactionPaused = false;
    syncAutoplayState();
  });

  techCarousel.addEventListener("focusin", () => {
    interactionPaused = true;
    syncAutoplayState();
  });

  techCarousel.addEventListener("focusout", (event) => {
    if (techCarousel.contains(event.relatedTarget)) return;

    interactionPaused = false;
    syncAutoplayState();
  });

  autoplayToggle?.addEventListener("click", () => {
    userPaused = !userPaused;
    syncAutoplayState();
  });

  document.addEventListener("product-image-lightbox-change", (event) => {
    lightboxPaused = Boolean(event.detail?.open);

    syncAutoplayState();
  });

  document.addEventListener("visibilitychange", syncAutoplayState);
  prefersReducedMotion.addEventListener("change", () => {
    if (prefersReducedMotion.matches) userPaused = true;
    syncAutoplayState();
  });

  if ("IntersectionObserver" in window) {
    const carouselObserver = new IntersectionObserver(
      ([entry]) => {
        carouselVisible = entry.isIntersecting;
        syncAutoplayState();
      },
      { threshold: 0.45 },
    );
    carouselObserver.observe(techCarousel);
  } else {
    carouselVisible = true;
  }

  applySlide(0);

  window.addEventListener("resize", () => {
    const profile = getTechProfile();
    if (profile === techCarousel.dataset.profile) return;
    if (dragPointerId !== null) finishPhoneLiveDrag(null, true);
    clearLiveDragStyles();
    applySlide(currentIndex);
  });
}

/* ================================================================
   MOBILE INDICATION ARTICLE REVEALS
   ================================================================ */

function setupIndicationArticleReveals() {
  const articles = Array.from(
    document.querySelectorAll(".indication-list article"),
  );

  if (!articles.length) {
    return;
  }

  articles.forEach((article, index) => {
    article.style.setProperty("--indication-reveal-delay", `${index * 105}ms`);
  });

  if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
    articles.forEach((article) => {
      article.classList.add("is-mobile-visible");
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-mobile-visible");

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.34,
      rootMargin: "0px 0px -7% 0px",
    },
  );

  articles.forEach((article) => {
    observer.observe(article);
  });
}

/* ================================================================
   MOBILE SCIENCE COPY REVEALS
   ================================================================ */

function setupScienceCopyReveals() {
  const items = Array.from(document.querySelectorAll(".science-copy"));

  if (!items.length) {
    return;
  }

  items.forEach((item, index) => {
    item.style.setProperty("--science-scroll-delay", `${index * 120}ms`);
  });

  if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => {
      item.classList.add("is-scroll-visible");
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-scroll-visible");

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.28,
      rootMargin: "0px 0px -6% 0px",
    },
  );

  items.forEach((item) => {
    observer.observe(item);
  });
}

/* ================================================================
   MOBILE NEEDLE SWITCH
   ================================================================ */

function setupNeedleSwitch() {
  const card = document.querySelector(".tech-card--needle");

  const controls = Array.from(
    card?.querySelectorAll("[data-needle-variant]") || [],
  );

  if (!card || !controls.length) {
    return;
  }

  const setVariant = (variant) => {
    card.dataset.needleActive = variant;

    controls.forEach((control) => {
      const active = control.dataset.needleVariant === variant;

      control.classList.toggle("is-active", active);

      control.setAttribute("aria-pressed", String(active));
    });
  };

  controls.forEach((control) => {
    control.addEventListener("click", (event) => {
      event.stopPropagation();

      setVariant(control.dataset.needleVariant);
    });
  });

  setVariant(card.dataset.needleActive || "standard");
}

/* ================================================================
   FAQ
   ================================================================ */

function setupFaqAccordion() {
  const faqItems = Array.from(
    document.querySelectorAll(".faq-section details"),
  );

  if (!faqItems.length) {
    return;
  }

  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) {
        return;
      }

      faqItems.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.open = false;
        }
      });
    });
  });
}

/* ================================================================
   SHARED HELPERS
   ================================================================ */

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function fade(progress, start, end) {
  return clamp((progress - start) / (end - start));
}

/* ================================================================
   GENERIC REVEALS
   ================================================================ */

if (reveals.length) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
    },
  );

  reveals.forEach((element) => {
    revealObserver.observe(element);
  });
}

/* ================================================================
   HERO CANVAS
   ================================================================ */

function getCanvasDimensions() {
  if (!canvas) {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  const bounds = canvas.getBoundingClientRect();

  return {
    width: Math.max(bounds.width, 1),

    height: Math.max(bounds.height, 1),
  };
}

function resizeCanvas() {
  if (!canvas || !context) {
    return;
  }

  const { width, height } = getCanvasDimensions();

  heroCanvasSize.width = width;

  heroCanvasSize.height = height;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(width * ratio);

  canvas.height = Math.round(height * ratio);

  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  drawHeroVideo();
}

/* ================================================================
   HERO VIDEO RENDERING
   ================================================================ */

function drawHeroVideo() {
  if (!canvas || !context || !heroVideo || !heroVideo.videoWidth || !heroVideo.videoHeight) return;

  const sourceWidth = heroVideo.videoWidth;
  const sourceHeight = heroVideo.videoHeight;
  const { width, height } = heroCanvasSize;
  const stageWidth = width * 0.72;
  const stageHeight = height * 0.84;
  const scale = Math.min(stageWidth / sourceWidth, stageHeight / sourceHeight);
  const renderWidth = sourceWidth * scale;
  const renderHeight = sourceHeight * scale;
  const renderX = (width - renderWidth) / 2;
  const renderY = (height - renderHeight) / 2;

  context.clearRect(0, 0, width, height);
  context.drawImage(heroVideo, renderX, renderY, renderWidth, renderHeight);
  updateFinalFeatureAnchors(heroVideo, renderX, renderY, renderWidth, renderHeight);
}

/* ================================================================
   HERO SCROLL SEQUENCE
   ================================================================ */

function updateSequence() {
  if (!heroSequence) {
    return;
  }

  if (prefersReducedMotion.matches) {
    return;
  }

  const bounds = heroSequence.getBoundingClientRect();

  const viewportHeight =
    heroSticky?.getBoundingClientRect().height || window.innerHeight;

  const totalScrollable = Math.max(bounds.height - viewportHeight, 1);

  const progress = Math.min(1, Math.max(0, -bounds.top / totalScrollable));

  const frameProgress = clamp(progress / framePhaseEnd);

  lastFrameProgress = frameProgress;

  requestHeroVideoProgress(frameProgress);

  const introProgress = 1 - fade(frameProgress, 0.06, 0.2);

  const midProgress =
    fade(frameProgress, 0.22, 0.4) * (1 - fade(frameProgress, 0.62, 0.76));

  const endProgress = fade(
    progress,
    FINAL_PHASE_START,
    FINAL_PHASE_START + 0.08,
  );

  const phaseIsInteractive = endProgress > 0.55;

  /* --------------------------------------------------------------
     Hero tagline
     -------------------------------------------------------------- */

  if (introTagline) {
    introTagline.style.opacity = introProgress;

    introTagline.style.transform = `translateY(${40 * (1 - introProgress)}px)`;
  }

  setHeaderProductNameReveal(frameProgress);

  /* --------------------------------------------------------------
     MidPhase
     -------------------------------------------------------------- */

  if (midPhase) {
    midPhase.setAttribute("aria-hidden", String(midProgress <= 0.01));
    midPhase.style.opacity = midProgress;

    midPhase.style.transform = `translateY(${24 * (1 - midProgress)}px)`;
  }

  /* --------------------------------------------------------------
     FinalPhase
     -------------------------------------------------------------- */

  if (endPhase) {
    endPhase.style.opacity = endProgress;

    endPhase.classList.toggle("is-interactive", phaseIsInteractive);

    endPhase.setAttribute("aria-hidden", phaseIsInteractive ? "false" : "true");

    endPhase.inert = !phaseIsInteractive;
  }

  if (heroVignette) {
    heroVignette.style.opacity = 1 - endProgress;
  }

  /* --------------------------------------------------------------
     Vellure scroll exit
     -------------------------------------------------------------- */

  if (heroVellure) {
    const vellureLift = 90 * (1 - introProgress);

    heroVellure.style.opacity = introProgress;

    heroVellure.style.transform = `translate(-50%, ${-vellureLift}px)`;
  }

  /* --------------------------------------------------------------
     Feature entrance
     -------------------------------------------------------------- */

  features.forEach((feature, index) => {
    const featureStart =
      FINAL_PHASE_START + 0.05 + index * FINAL_FEATURE_STAGGER;

    const featureProgress = fade(
      progress,
      featureStart,
      featureStart + FINAL_FEATURE_FADE_DURATION,
    );

    feature.style.opacity = endProgress * featureProgress;

    feature.style.setProperty(
      "--feature-shift",
      `${18 * (1 - featureProgress)}px`,
    );

    feature.style.setProperty("--feature-shift-x", "0px");

    if (feature instanceof HTMLButtonElement) {
      feature.disabled = !phaseIsInteractive;
    }
  });
}

function scheduleSequenceUpdate() {
  if (sequenceRaf !== null) {
    return;
  }

  sequenceRaf = requestAnimationFrame(() => {
    sequenceRaf = null;

    updateSequence();
  });
}

/* ================================================================
   RESIZE HELPERS
   ================================================================ */

function debounce(func, timeout = 300) {
  let timer;

  const debounced = (...args) => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

function startSequence() {
  if (animationStarted) {
    return;
  }

  animationStarted = true;

  resizeCanvas();
  scheduleSequenceUpdate();
}

function handleHeroResize() {
  if (!allowFullMotion() || !context) return;
  resizeCanvas();
  requestHeroVideoProgress(lastFrameProgress);
  scheduleSequenceUpdate();
}
/* ================================================================
   PRESENTATION DETAILS
   ================================================================ */

function initDetails(container = document) {
  const items = Array.from(
    container.querySelectorAll(".details > details.details__item"),
  );

  if (!items.length) {
    return;
  }

  const syncItem = (item) => {
    const summary = item.querySelector("summary");

    item.classList.toggle("is-expanded", item.open);

    summary?.setAttribute("aria-expanded", String(item.open));
  };

  const presentationCard = items[0]?.closest(".tech-card--presentations");

  const presentationDesktopArtwork = presentationCard?.querySelector(
    ".card1__visual--desktop .card1__art",
  );

  const presentationMobileArtwork = presentationCard?.querySelector(
    ".card1__visual--mobile .card1__art--mobile",
  );

  const presentationArtworkSources = [
    "images/cards/card1_1ml.webp",
    "images/cards/card1_2ml.webp",
  ];

  /*
    Preload both variants so mobile can switch src without the decode
    pop that would happen on the first toggle.
  */
  const presentationArtworkPreloads = presentationArtworkSources.map(
    (source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      return image;
    },
  );

  const syncPresentationArtwork = () => {
    const activeIndex = items.findIndex((item) => item.open);

    if (activeIndex < 0) {
      return;
    }

    const source = presentationArtworkSources[activeIndex];

    if (!source) {
      return;
    }

    [presentationDesktopArtwork, presentationMobileArtwork].forEach(
      (artwork) => {
        if (!artwork) {
          return;
        }

        if (!artwork.src.endsWith(source)) {
          artwork.src = source;
        }
      },
    );
  };

  const setOpen = (targetItem, shouldOpen) => {
    items.forEach((item) => {
      item.open = item === targetItem ? shouldOpen : false;

      syncItem(item);
    });

    syncPresentationArtwork();
  };

  syncPresentationArtwork();

  items.forEach((item) => {
    const summary = item.querySelector("summary");

    syncItem(item);

    const toggleItem = (event) => {
      event.preventDefault();
      event.stopPropagation();

      setOpen(item, true);
    };

    item.addEventListener("click", toggleItem);

    item.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    summary?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      toggleItem(event);
    });
  });
}

/* ================================================================
   SCIENCE METRIC
   ================================================================ */

function setupScienceMetric() {
  const metrics = document.querySelectorAll(".science-metric li");

  if (!metrics.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const bars = entry.target.querySelectorAll("i");

        bars.forEach((bar, index) => {
          setTimeout(() => {
            /*
                      Do NOT remove
                      .is-off.

                      .is-off represents
                      the actual metric
                      value.

                      Animation uses its
                      own class instead.
                    */
            bar.classList.add("is-animated");
          }, index * 110);
        });

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.5,
    },
  );

  metrics.forEach((metric) => {
    observer.observe(metric);
  });
}

/* ================================================================
   HERO INTRO VELLURE ENTRANCE
   ================================================================ */

let vellureIntroRevealStarted = false;
let vellureIntroRevealTimer = null;

function startVellureIntroReveal() {
  if (vellureIntroRevealStarted) {
    return;
  }

  vellureIntroRevealStarted = true;

  if (vellureIntroRevealTimer !== null) {
    clearTimeout(vellureIntroRevealTimer);
  }

  /*
    Keep the syringe visible and stationary first. Then Vellure rises
    into its already-approved final position with a soft fade.
  */
  vellureIntroRevealTimer = window.setTimeout(
    () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.add("hero-vellure-intro-ready");
        });
      });
    },
    prefersReducedMotion.matches ? 0 : 100,
  );
}

function prepareStaticVellureIntroReveal() {
  if (vellureIntroRevealStarted || desktopExperienceQuery.matches) {
    return;
  }

  if (!staticHeroIntroImage) {
    startVellureIntroReveal();
    return;
  }

  const startAfterDecode = () => {
    const decodePromise =
      typeof staticHeroIntroImage.decode === "function"
        ? staticHeroIntroImage.decode().catch(() => {})
        : Promise.resolve();

    decodePromise.finally(startVellureIntroReveal);
  };

  if (staticHeroIntroImage.complete && staticHeroIntroImage.naturalWidth) {
    startAfterDecode();
    return;
  }

  staticHeroIntroImage.addEventListener("load", startAfterDecode, {
    once: true,
  });

  staticHeroIntroImage.addEventListener("error", startVellureIntroReveal, {
    once: true,
  });
}

/* ================================================================
   HERO INITIALIZATION
   ================================================================ */

function allowFullMotion() {
  return (
    desktopExperienceQuery.matches &&
    !prefersReducedMotion.matches &&
    !heroFailed
  );
}

function activateHeroFallback() {
  heroFailed = true;
  destroyHeroSequence();
  document.documentElement.dataset.heroMode = "static";
  setupStaticHeroScenes();
}

function initHeroSequence() {
  if (heroSequenceCleanup || !canvas || !heroVideo || !heroSequence) return;

  context = canvas.getContext("2d");
  if (!context) {
    activateHeroFallback();
    return;
  }

  let videoStarted = false;
  const startVideoSequence = () => {
    if (
      videoStarted ||
      !allowFullMotion() ||
      heroVideo.readyState < 2 ||
      !getHeroVideoDuration()
    ) return;

    videoStarted = true;
    heroVideo.pause();
    heroVideo.addEventListener("seeked", handleHeroVideoSeeked);
    startSequence();
    startVellureIntroReveal();
    requestHeroVideoProgress(lastFrameProgress);
  };
  const handleHeroVideoError = () => {
    if (allowFullMotion()) activateHeroFallback();
  };

  heroVideo.addEventListener("loadeddata", startVideoSequence, { once: true });
  heroVideo.addEventListener("error", handleHeroVideoError, { once: true });
  heroVideo.preload = "auto";
  if (heroVideo.readyState >= 2 && getHeroVideoDuration()) {
    startVideoSequence();
  } else {
    heroVideo.load();
  }

  const onHeroViewportResize = debounce(handleHeroResize, 150);
  window.addEventListener("scroll", scheduleSequenceUpdate, { passive: true });
  window.addEventListener("resize", onHeroViewportResize);
  window.visualViewport?.addEventListener("resize", onHeroViewportResize);

  heroSequenceCleanup = () => {
    onHeroViewportResize.cancel();
    window.removeEventListener("scroll", scheduleSequenceUpdate);
    window.removeEventListener("resize", onHeroViewportResize);
    window.visualViewport?.removeEventListener("resize", onHeroViewportResize);
    heroVideo.removeEventListener("loadeddata", startVideoSequence);
    heroVideo.removeEventListener("error", handleHeroVideoError);
    heroVideo.removeEventListener("seeked", handleHeroVideoSeeked);
    heroVideo.pause();
    if (sequenceRaf !== null) {
      cancelAnimationFrame(sequenceRaf);
      sequenceRaf = null;
    }
    animationStarted = false;
    currentVideoTime = -1;
    pendingVideoTime = null;
    lastFrameProgress = 0;
    if (context && canvas) context.clearRect(0, 0, heroCanvasSize.width, heroCanvasSize.height);
    context = null;
    heroSequenceCleanup = null;
  };
}
function destroyHeroSequence() {
  heroSequenceCleanup?.();
}

function setupStaticHeroScenes() {
  if (!staticHeroScenes.length) {
    return;
  }

  staticHeroObserver?.disconnect();
  if (prefersReducedMotion.matches) {
    staticHeroScenes.forEach((scene) => {
      scene.classList.add("is-visible");
    });

    return;
  }

  staticHeroObserver?.disconnect();

  staticHeroObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");

        staticHeroObserver?.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  staticHeroScenes.forEach((scene) => {
    staticHeroObserver.observe(scene);
  });
}

function setHeaderProductNameReveal(progress) {
  if (!headerProductName) return;

  const opacity = fade(
    progress,
    HEADER_PRODUCT_REVEAL_START,
    HEADER_PRODUCT_REVEAL_END,
  );

  headerProductName.style.opacity = opacity;
  headerProductName.style.pointerEvents = opacity > 0.01 ? "auto" : "none";
}

function syncStaticHeaderProductNameReveal() {
  staticHeaderProductNameCleanup?.();
  staticHeaderProductNameCleanup = null;

  if (document.documentElement.dataset.heroMode !== "static") {
    setHeaderProductNameReveal(0);
    return;
  }

  const introScene = staticHeroScenes[0];
  if (!introScene) return;

  let frame = 0;
  const update = () => {
    frame = 0;
    const bounds = introScene.getBoundingClientRect();
    const progress = clamp(-bounds.top / Math.max(bounds.height, 1));
    setHeaderProductNameReveal(progress);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();

  staticHeaderProductNameCleanup = () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}

let initialScienceSyncCompleted = false;
let initialScienceSyncTimer = null;

function scheduleScienceExperienceSync() {
  if (initialScienceSyncCompleted) {
    syncScienceExperience();
    return;
  }

  if (initialScienceSyncTimer !== null) {
    return;
  }

  initialScienceSyncTimer = window.setTimeout(() => {
    initialScienceSyncTimer = null;
    initialScienceSyncCompleted = true;

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => syncScienceExperience(), {
        timeout: 700,
      });
    } else {
      syncScienceExperience();
    }
  }, 1750);
}

async function syncScienceExperience() {
  const version = ++scienceSyncVersion;
  const useMotion =
    scienceExperienceQuery.matches && !prefersReducedMotion.matches;
  if (!useMotion) {
    scienceCleanup?.();
    scienceCleanup = null;
    document.documentElement.dataset.scienceMode = "static";
    return;
  }
  if (scienceCleanup) return;
  document.documentElement.dataset.scienceMode = "static";
  try {
    scienceModulePromise ||=
      import("./liquid-metaballs.js?v=tablet-stabilized-v2-20260924");
    const module = await scienceModulePromise;
    if (version !== scienceSyncVersion) return;
    // Make the container measurable before synchronous renderer creation.
    document.documentElement.dataset.scienceMode = "motion";
    const cleanup = module.initLiquidMetaballs();
    if (typeof cleanup !== "function")
      throw new Error("Liquid scene was not initialized.");
    scienceCleanup = cleanup;
  } catch (error) {
    if (version !== scienceSyncVersion) return;
    scienceModulePromise = null;
    document.documentElement.dataset.scienceMode = "static";
    console.warn("Liquid scene unavailable; showing static content.", error);
  }
}

function syncResponsiveExperience() {
  const useMotion = allowFullMotion();

  document.documentElement.dataset.heroMode = useMotion ? "motion" : "static";
  syncStaticHeaderProductNameReveal();

  if (useMotion) {
    initHeroSequence();
  } else {
    destroyHeroSequence();

    staticHeroScenes.forEach((scene) => {
      scene.classList.remove("is-visible");
    });

    requestAnimationFrame(() => {
      setupStaticHeroScenes();
      prepareStaticVellureIntroReveal();
    });
  }

  scheduleScienceExperienceSync();
}

function setupResponsiveExperience() {
  scienceExperienceQuery.addEventListener("change", syncScienceExperience);
  setupStaticHeroScenes();
  prepareStaticVellureIntroReveal();
  syncResponsiveExperience();

  desktopExperienceQuery.addEventListener("change", syncResponsiveExperience);

  prefersReducedMotion.addEventListener("change", () => {
    setupStaticHeroScenes();
    syncResponsiveExperience();
  });
}

/* ================================================================
   BACK TO TOP
   ================================================================ */

function setupBackToTop() {
  const btn = document.querySelector(".back-to-top");

  const footer = document.querySelector(".brand-outro");

  if (!btn || !footer) {
    return;
  }

  const setVisible = (visible) => {
    btn.classList.toggle("is-visible", Boolean(visible));
    btn.tabIndex = visible ? 0 : -1;
    btn.setAttribute("aria-hidden", String(!visible));
  };

  if ("IntersectionObserver" in window) {
    const footerObserver = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.06,
      },
    );

    footerObserver.observe(footer);
  } else {
    const syncVisibility = () => {
      const rect = footer.getBoundingClientRect();

      setVisible(rect.top < window.innerHeight && rect.bottom > 0);
    };

    window.addEventListener("scroll", syncVisibility, { passive: true });

    window.addEventListener("resize", syncVisibility, { passive: true });

    syncVisibility();
  }

  btn.addEventListener("click", (event) => {
    event.preventDefault();

    document.getElementById("top")?.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });
  });
}

/* ================================================================
   MOBILE PRODUCT DETAILS
   ================================================================ */

function setupMobileFeatureShowcase() {
  const showcase = document.querySelector(".mobile-feature-showcase");
  const player = showcase?.querySelector(".mobile-feature-showcase__video");
  let mobileVideoLoadRequestId = 0;
  const poster = showcase?.querySelector(".mobile-feature-showcase__poster");
  const closeButton = showcase?.querySelector(
    ".mobile-feature-showcase__close",
  );
  const rail = showcase?.querySelector(".mobile-feature-showcase__grid");
  const controls = Array.from(
    showcase?.querySelectorAll("[data-mobile-feature-key]") || [],
  );

  if (
    !showcase ||
    !player ||
    !poster ||
    !closeButton ||
    !rail ||
    !controls.length
  ) {
    return;
  }

  hardDisableNativeVideoControls(player);

  setupInteractiveVideoPlayback(player);

  player.addEventListener("loadedmetadata", () => {
    applyVideoSpeed(player, player.dataset.videoKey);
  });

  const GAP = 8;
  const CLOSED_BOTTOM = 10;
  const CLOSED_HEIGHT = 50;

  const ACTIVE_HEIGHT = 72;
  const ACTIVE_RADIUS = 18;

  const NAV_WIDTH = 38;
  const NAV_HEIGHT = 48;
  const NAV_RADIUS = 24;
  const NAV_GAP = 8;

  let selectedIndex = -1;
  let railOffset = 0;

  let closedWidths = [];
  let baseClosedX = [];

  let animationFrame = null;
  let isAnimating = false;

  let pointerId = null;
  let pointerMode = null;
  let pointerStartX = 0;
  let pointerLastX = 0;
  let pointerLastTime = 0;
  let pointerVelocity = 0;
  let pointerMoved = false;
  let startRailOffset = 0;

  let dragFromIndex = -1;
  let dragTargetIndex = -1;
  let dragProgress = 0;

  let inertiaFrame = null;
  let suppressClickUntil = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const clamp01 = (value) => clamp(value, 0, 1);

  const lerp = (from, to, amount) => from + (to - from) * amount;

  const easeOut = (value) => 1 - Math.pow(1 - clamp01(value), 3);

  function railWidth() {
    return rail.clientWidth || 1;
  }

  function railHeight() {
    return rail.clientHeight || 118;
  }

  function activeY() {
    return railHeight() - CLOSED_BOTTOM - ACTIVE_HEIGHT;
  }

  function navY() {
    return activeY() + (ACTIVE_HEIGHT - NAV_HEIGHT) / 2;
  }

  function closedY() {
    return railHeight() - CLOSED_BOTTOM - CLOSED_HEIGHT;
  }

  function featureTitle(index) {
    const label = controls[index]?.querySelector(
      ".mobile-feature-showcase__label",
    );

    if (!label) return `Detalhe ${index + 1}`;

    const clone = label.cloneNode(true);
    clone.querySelectorAll("strong").forEach((node) => node.remove());

    return clone.textContent.trim();
  }

  const titles = controls.map((_, index) => featureTitle(index));

  function measureClosedWidths() {
    closedWidths = controls.map((control) => {
      const label = control.querySelector(".mobile-feature-showcase__label");

      const labelWidth = label?.scrollWidth || 90;

      const viewportWidth = window.innerWidth;

      const minWidth = viewportWidth <= 350 ? 142 : 154;

      const maxWidth = viewportWidth <= 350 ? 172 : 205;

      return clamp(labelWidth + 70, minWidth, maxWidth);
    });

    let x = 10;

    baseClosedX = closedWidths.map((width) => {
      const current = x;
      x += width + GAP;
      return current;
    });
  }

  function centeredOffset(index) {
    const width = closedWidths[index] || 160;

    const x = baseClosedX[index] || 0;

    return railWidth() / 2 - (x + width / 2);
  }

  function railBounds() {
    return {
      max: centeredOffset(0),
      min: centeredOffset(controls.length - 1),
    };
  }

  function clampRailOffset(value) {
    const bounds = railBounds();

    return clamp(value, bounds.min, bounds.max);
  }

  function closedRadii() {
    return [
      CLOSED_HEIGHT / 2,
      CLOSED_HEIGHT / 2,
      CLOSED_HEIGHT / 2,
      CLOSED_HEIGHT / 2,
    ];
  }

  function activeRadii() {
    return [ACTIVE_RADIUS, ACTIVE_RADIUS, ACTIVE_RADIUS, ACTIVE_RADIUS];
  }

  function previousNavRadii() {
    return [0, NAV_RADIUS, NAV_RADIUS, 0];
  }

  function nextNavRadii() {
    return [NAV_RADIUS, 0, 0, NAV_RADIUS];
  }

  function makeClosedLayout(offset = railOffset) {
    const width = railWidth();
    const center = width / 2;

    const depthRadius = Math.max(width * 0.72, 1);

    return controls.map((_, index) => {
      const itemWidth = closedWidths[index];

      const x = baseClosedX[index] + offset;

      const itemCenter = x + itemWidth / 2;

      const normalized = clamp((itemCenter - center) / depthRadius, -1, 1);

      const distance = Math.abs(normalized);

      return {
        x,
        y: closedY(),
        width: itemWidth,
        height: CLOSED_HEIGHT,
        radii: closedRadii(),
        accent: 0,
        plus: 1,
        content: 1,
        desc: 0,
        chevron: 0,
        navDir: 0,
        scale: 1 - distance * 0.075,
        rotate: normalized * -7,
        opacity: 1 - distance * 0.18,
      };
    });
  }

  function offscreenState(index, side, cursor) {
    const itemWidth = closedWidths[index];

    return {
      x: side < 0 ? cursor - itemWidth : cursor,
      y: closedY(),
      width: itemWidth,
      height: CLOSED_HEIGHT,
      radii: closedRadii(),
      accent: 0,
      plus: 0,
      content: 0,
      desc: 0,
      chevron: 0,
      navDir: 0,
      scale: 1,
      rotate: 0,
      opacity: 1,
    };
  }

  function makeActiveLayout(index) {
    const width = railWidth();

    const hasPrevious = index > 0;

    const hasNext = index < controls.length - 1;

    const leftInset = hasPrevious ? NAV_WIDTH + NAV_GAP : 10;

    const rightInset = hasNext ? NAV_WIDTH + NAV_GAP : 10;

    const layout = new Array(controls.length);

    layout[index] = {
      x: leftInset,
      y: activeY(),
      width: width - leftInset - rightInset,
      height: ACTIVE_HEIGHT,
      radii: activeRadii(),
      accent: 1,
      plus: 0,
      content: 1,
      desc: 1,
      chevron: 0,
      navDir: 0,
      scale: 1,
      rotate: 0,
      opacity: 1,
    };

    /*
      The adjacent persistent FEATURE elements ARE the nav buttons.
      They are not duplicated by separate controls.
    */
    if (hasPrevious) {
      layout[index - 1] = {
        x: 0,
        y: navY(),
        width: NAV_WIDTH,
        height: NAV_HEIGHT,
        radii: previousNavRadii(),
        accent: 0,
        plus: 0,
        content: 0,
        desc: 0,
        chevron: 1,
        navDir: -1,
        scale: 1,
        rotate: 0,
        opacity: 1,
      };
    }

    if (hasNext) {
      layout[index + 1] = {
        x: width - NAV_WIDTH,
        y: navY(),
        width: NAV_WIDTH,
        height: NAV_HEIGHT,
        radii: nextNavRadii(),
        accent: 0,
        plus: 0,
        content: 0,
        desc: 0,
        chevron: 1,
        navDir: 1,
        scale: 1,
        rotate: 0,
        opacity: 1,
      };
    }

    let leftCursor = -12;

    for (let i = index - (hasPrevious ? 2 : 1); i >= 0; i -= 1) {
      const state = offscreenState(i, -1, leftCursor);

      layout[i] = state;

      leftCursor = state.x - GAP;
    }

    let rightCursor = width + 12;

    for (let i = index + (hasNext ? 2 : 1); i < controls.length; i += 1) {
      const state = offscreenState(i, 1, rightCursor);

      layout[i] = state;

      rightCursor = state.x + state.width + GAP;
    }

    return layout;
  }

  function interpolateRadii(from, to, progress) {
    return from.map((value, index) => lerp(value, to[index], progress));
  }

  function interpolateLayout(fromLayout, toLayout, progress) {
    const t = clamp01(progress);

    return fromLayout.map((from, index) => {
      const to = toLayout[index];

      return {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        width: lerp(from.width, to.width, t),
        height: lerp(from.height, to.height, t),
        radii: interpolateRadii(from.radii, to.radii, t),
        accent: lerp(from.accent, to.accent, t),
        plus: lerp(from.plus, to.plus, t),
        content: lerp(from.content, to.content, t),
        desc: lerp(from.desc, to.desc, t),
        chevron: lerp(from.chevron, to.chevron, t),
        navDir: from.navDir !== 0 ? from.navDir : to.navDir,
        scale: lerp(from.scale, to.scale, t),
        rotate: lerp(from.rotate, to.rotate, t),
        opacity: lerp(from.opacity, to.opacity, t),
      };
    });
  }

  function setFeatureVisual(control, state) {
    const accent = clamp01(state.accent);

    const radii = state.radii;

    const pinkR = Math.round(lerp(31, 126, accent));

    const pinkG = Math.round(lerp(29, 27, accent));

    const pinkB = Math.round(lerp(32, 76, accent));

    control.style.width = `${state.width}px`;

    control.style.height = `${state.height}px`;

    control.style.borderRadius =
      `${radii[0]}px ` + `${radii[1]}px ` + `${radii[2]}px ` + `${radii[3]}px`;

    control.style.opacity = `${state.opacity}`;

    control.style.backgroundColor = `rgba(${pinkR}, ${pinkG}, ${pinkB}, 0.98)`;

    control.style.borderColor =
      `rgba(238, 178, 211, ` + `${lerp(0.14, 0.58, accent)})`;

    control.style.boxShadow =
      accent > 0.01
        ? `0 ${Math.round(12 * accent)}px ` +
          `${Math.round(32 * accent)}px ` +
          `rgba(103, 20, 61, ${0.28 * accent})`
        : "none";

    control.style.transform =
      `translate3d(${state.x}px, ${state.y}px, 0) ` +
      `rotateY(${state.rotate}deg) ` +
      `scale(${state.scale})`;

    const plusOpacity = clamp01(state.plus);

    /*
      Stage nav/content instead of cross-fading them over each other.

      Nav -> active:
      - chevron disappears during the first ~25% of the morph
      - title/content starts appearing after the nav is already gone

      Active -> nav:
      - content disappears before the chevron is allowed to appear

      The element itself remains the SAME persistent feature throughout.
    */
    const rawChevron = clamp01(state.chevron);

    const rawContent = clamp01(state.content);

    const chevronOpacity = clamp01((rawChevron - 0.72) / 0.28);

    const contentOpacity =
      clamp01((rawContent - 0.3) / 0.7) * (1 - chevronOpacity);

    const descriptionOpacity =
      clamp01((state.desc - 0.34) / 0.66) * contentOpacity;

    control.style.setProperty("--feature-plus", plusOpacity.toFixed(4));

    control.style.setProperty("--feature-content", contentOpacity.toFixed(4));

    control.style.setProperty("--feature-desc", descriptionOpacity.toFixed(4));

    control.style.setProperty("--feature-chevron", chevronOpacity.toFixed(4));

    control.style.setProperty(
      "--feature-chevron-visibility",
      chevronOpacity > 0.001 ? "visible" : "hidden",
    );

    control.style.setProperty(
      "--feature-content-visibility",
      contentOpacity > 0.001 ? "visible" : "hidden",
    );

    const chevron = control.querySelector(".mobile-feature-showcase__chevron");

    if (chevron) {
      /*
        Completely remove the glyph when the persistent feature
        is no longer acting as a navigation edge.
      */
      chevron.textContent =
        chevronOpacity <= 0.001
          ? ""
          : state.navDir < 0
            ? "‹"
            : state.navDir > 0
              ? "›"
              : "";
    }
  }

  function renderLayout(layout) {
    controls.forEach((control, index) => {
      setFeatureVisual(control, layout[index]);
    });
  }

  function setSemanticState(index) {
    selectedIndex = index;

    const isOpen = selectedIndex >= 0;

    showcase.classList.toggle("is-slider-mode", isOpen);

    controls.forEach((control, controlIndex) => {
      const active = controlIndex === selectedIndex;

      const isPreviousNav = isOpen && controlIndex === selectedIndex - 1;

      const isNextNav = isOpen && controlIndex === selectedIndex + 1;

      control.setAttribute("aria-pressed", String(active));

      control.setAttribute("aria-expanded", String(active));

      if (active) {
        control.setAttribute(
          "aria-label",
          `${titles[controlIndex]}. Fechar detalhe.`,
        );
      } else if (isPreviousNav) {
        control.setAttribute(
          "aria-label",
          `Detalhe anterior: ${titles[controlIndex]}`,
        );
      } else if (isNextNav) {
        control.setAttribute(
          "aria-label",
          `Próximo detalhe: ${titles[controlIndex]}`,
        );
      } else {
        control.setAttribute("aria-label", titles[controlIndex]);
      }
    });
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);

      animationFrame = null;
    }

    isAnimating = false;

    showcase.classList.remove("is-feature-animating");
  }

  function animateLayouts({
    fromLayout,
    toLayout,
    fromProgress = 0,
    toProgress = 1,
    duration = 460,
    onComplete,
  }) {
    stopAnimation();

    isAnimating = true;

    showcase.classList.add("is-feature-animating");

    const startTime = performance.now();

    const step = (now) => {
      const linear = duration <= 0 ? 1 : clamp01((now - startTime) / duration);

      const eased = easeOut(linear);

      const progress = lerp(fromProgress, toProgress, eased);

      renderLayout(interpolateLayout(fromLayout, toLayout, progress));

      if (linear >= 1) {
        animationFrame = null;
        isAnimating = false;

        showcase.classList.remove("is-feature-animating");

        onComplete?.();
        return;
      }

      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
  }

  async function playFeatureAtIndex(index) {
    const control = controls[index];

    const key = control?.dataset.mobileFeatureKey;

    const feature = videoCatalog[key];

    if (!feature?.src) return;

    const requestId = ++mobileVideoLoadRequestId;

    player.pause();
    player.removeAttribute("src");
    player.load();

    player.dataset.videoKey = key;

    applyVideoSpeed(player, key);

    applyVideoScale(player, key, "mobile");

    const resolvedSrc = await resolveVersionedVideoUrl(feature.src);

    if (requestId !== mobileVideoLoadRequestId || selectedIndex !== index) {
      return;
    }

    player.src = resolvedSrc;
    player.currentTime = 0;

    player.classList.add("is-visible");

    poster.classList.add("is-hidden");

    showcase.classList.add("is-playing");

    player.load();

    const playing = player.play();

    if (playing?.catch) {
      playing.catch(() => {});
    }
  }

  function stopPlayer() {
    mobileVideoLoadRequestId += 1;
    player.pause();

    player.removeAttribute("src");
    player.removeAttribute("data-video-key");
    player.load();

    player.classList.remove("is-visible");

    poster.classList.remove("is-hidden");

    showcase.classList.remove("is-playing");
  }

  function openFeature(index) {
    if (
      isAnimating ||
      selectedIndex >= 0 ||
      index < 0 ||
      index >= controls.length
    ) {
      return;
    }

    const fromLayout = makeClosedLayout();

    const toLayout = makeActiveLayout(index);

    animateLayouts({
      fromLayout,
      toLayout,
      duration: 480,
      onComplete: () => {
        setSemanticState(index);
        renderLayout(toLayout);
        playFeatureAtIndex(index);
      },
    });
  }

  function closeFeature() {
    if (isAnimating || selectedIndex < 0) {
      return;
    }

    const closingIndex = selectedIndex;

    const focusedOffset = clampRailOffset(centeredOffset(closingIndex));

    const fromLayout = makeActiveLayout(closingIndex);

    const toLayout = makeClosedLayout(focusedOffset);

    animateLayouts({
      fromLayout,
      toLayout,
      duration: 440,
      onComplete: () => {
        railOffset = focusedOffset;

        stopPlayer();

        setSemanticState(-1);

        renderLayout(makeClosedLayout());

        controls[closingIndex]?.focus?.({
          preventScroll: true,
        });
      },
    });
  }

  function changeFeature(targetIndex, { startProgress = 0, duration } = {}) {
    if (
      isAnimating ||
      selectedIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= controls.length ||
      targetIndex === selectedIndex
    ) {
      return;
    }

    /*
      IMPORTANT:
      The target feature is already the visible ‹ / › nav shape
      in the FROM layout. It expands from that exact geometry.
      The current active feature simultaneously contracts into
      the opposite nav role in the TO layout.
    */
    const fromIndex = selectedIndex;

    const fromLayout = makeActiveLayout(fromIndex);

    const toLayout = makeActiveLayout(targetIndex);

    animateLayouts({
      fromLayout,
      toLayout,
      fromProgress: startProgress,
      toProgress: 1,
      duration: duration ?? Math.max(150, 390 * (1 - startProgress)),
      onComplete: () => {
        setSemanticState(targetIndex);

        renderLayout(toLayout);

        playFeatureAtIndex(targetIndex);
      },
    });
  }

  function cancelActiveDrag(fromIndex, targetIndex, progress) {
    const fromLayout = makeActiveLayout(fromIndex);

    const toLayout = makeActiveLayout(targetIndex);

    animateLayouts({
      fromLayout,
      toLayout,
      fromProgress: progress,
      toProgress: 0,
      duration: Math.max(120, 260 * progress),
      onComplete: () => {
        renderLayout(fromLayout);
      },
    });
  }

  function renderActiveDrag(targetIndex, progress) {
    const fromLayout = makeActiveLayout(dragFromIndex);

    const toLayout = makeActiveLayout(targetIndex);

    renderLayout(interpolateLayout(fromLayout, toLayout, progress));
  }

  function finishActiveDrag({ cancelled = false } = {}) {
    if (pointerMode !== "active") {
      return;
    }

    const fromIndex = dragFromIndex;

    const targetIndex = dragTargetIndex;

    const progress = dragProgress;

    const velocity = Math.abs(pointerVelocity);

    pointerMode = null;
    pointerId = null;

    rail.classList.remove("is-active-dragging");

    if (cancelled || targetIndex < 0) {
      if (targetIndex >= 0 && progress > 0) {
        cancelActiveDrag(fromIndex, targetIndex, progress);
      } else {
        renderLayout(makeActiveLayout(fromIndex));
      }

      dragFromIndex = -1;
      dragTargetIndex = -1;
      dragProgress = 0;
      return;
    }

    const commit = progress >= 0.34 || velocity >= 0.42;

    if (commit) {
      changeFeature(targetIndex, {
        startProgress: progress,
      });
    } else {
      cancelActiveDrag(fromIndex, targetIndex, progress);
    }

    dragFromIndex = -1;
    dragTargetIndex = -1;
    dragProgress = 0;

    suppressClickUntil = performance.now() + 220;
  }

  function startInertia() {
    if (inertiaFrame !== null) {
      cancelAnimationFrame(inertiaFrame);
    }

    let velocity = pointerVelocity * 18;

    const step = () => {
      velocity *= 0.94;

      railOffset = clampRailOffset(railOffset + velocity);

      renderLayout(makeClosedLayout());

      if (Math.abs(velocity) < 0.18) {
        inertiaFrame = null;
        return;
      }

      inertiaFrame = requestAnimationFrame(step);
    };

    inertiaFrame = requestAnimationFrame(step);
  }

  controls.forEach((control, index) => {
    control.addEventListener("click", (event) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }

      if (selectedIndex < 0) {
        openFeature(index);
        return;
      }

      if (index === selectedIndex) {
        closeFeature();
        return;
      }

      /*
            Adjacent persistent feature = visible nav button.
            Tapping it expands that SAME feature into active.
          */
      if (index === selectedIndex - 1 || index === selectedIndex + 1) {
        changeFeature(index);
      }
    });
  });

  closeButton.addEventListener("click", closeFeature);

  rail.addEventListener("pointerdown", (event) => {
    if (isAnimating) return;

    if (inertiaFrame !== null) {
      cancelAnimationFrame(inertiaFrame);

      inertiaFrame = null;
    }

    const feature = event.target.closest(".mobile-feature-showcase__feature");

    if (selectedIndex >= 0) {
      /*
          Drag navigation begins from the active feature itself.
          The target adjacent FEATURE is already the nav shape
          and grows continuously as drag progress increases.
        */
      if (feature !== controls[selectedIndex]) {
        return;
      }

      pointerMode = "active";
      dragFromIndex = selectedIndex;

      dragTargetIndex = -1;
      dragProgress = 0;

      rail.classList.add("is-active-dragging");
    } else {
      pointerMode = "rail";

      startRailOffset = railOffset;

      rail.classList.add("is-dragging");
    }

    pointerId = event.pointerId;

    pointerStartX = event.clientX;

    pointerLastX = event.clientX;

    pointerLastTime = performance.now();

    pointerVelocity = 0;
    pointerMoved = false;

    rail.setPointerCapture?.(event.pointerId);
  });

  rail.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    const delta = event.clientX - pointerStartX;

    if (Math.abs(delta) > 4) {
      pointerMoved = true;
    }

    const now = performance.now();

    const elapsed = Math.max(now - pointerLastTime, 1);

    const instantVelocity = (event.clientX - pointerLastX) / elapsed;

    pointerVelocity = pointerVelocity * 0.7 + instantVelocity * 0.3;

    pointerLastX = event.clientX;

    pointerLastTime = now;

    if (pointerMode === "rail") {
      railOffset = clampRailOffset(startRailOffset + delta);

      renderLayout(makeClosedLayout());

      return;
    }

    if (pointerMode === "active") {
      const wantsPrevious = delta > 0;

      const targetIndex = dragFromIndex + (wantsPrevious ? -1 : 1);

      if (targetIndex < 0 || targetIndex >= controls.length) {
        dragTargetIndex = -1;
        dragProgress = 0;

        renderLayout(makeActiveLayout(dragFromIndex));

        return;
      }

      dragTargetIndex = targetIndex;

      const activeLayout = makeActiveLayout(dragFromIndex);

      const activeWidth = activeLayout[dragFromIndex].width;

      dragProgress = clamp01(Math.abs(delta) / Math.max(activeWidth * 0.62, 1));

      renderActiveDrag(targetIndex, dragProgress);
    }
  });

  function releasePointer(event, cancelled = false) {
    if (pointerId !== event.pointerId) {
      return;
    }

    try {
      rail.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    if (pointerMode === "active") {
      finishActiveDrag({
        cancelled,
      });
    } else if (pointerMode === "rail") {
      pointerMode = null;
      pointerId = null;

      rail.classList.remove("is-dragging");

      if (pointerMoved && !cancelled) {
        startInertia();

        suppressClickUntil = performance.now() + 220;
      }
    }

    requestAnimationFrame(() => {
      pointerMoved = false;
    });
  }

  rail.addEventListener("pointerup", (event) => releasePointer(event, false));

  rail.addEventListener("pointercancel", (event) =>
    releasePointer(event, true),
  );

  player.addEventListener("ended", () => {
    /* Keep final video frame and active detail visible. */
  });

  function refreshGeometry({ preserveFocus = true } = {}) {
    const focusedIndex =
      preserveFocus && selectedIndex < 0
        ? controls.findIndex((control) => document.activeElement === control)
        : -1;

    measureClosedWidths();

    if (selectedIndex >= 0) {
      renderLayout(makeActiveLayout(selectedIndex));

      setSemanticState(selectedIndex);
    } else {
      if (focusedIndex >= 0) {
        railOffset = clampRailOffset(centeredOffset(focusedIndex));
      } else {
        railOffset = clampRailOffset(railOffset);
      }

      renderLayout(makeClosedLayout());

      setSemanticState(-1);
    }
  }

  window.addEventListener(
    "resize",
    () => {
      stopAnimation();
      refreshGeometry();
    },
    { passive: true },
  );

  function resetInitialRailToStart() {
    if (selectedIndex >= 0) {
      return;
    }

    railOffset = 0;

    renderLayout(makeClosedLayout(0));
  }

  setSemanticState(-1);

  measureClosedWidths();

  /*
    Fresh/reloaded page: the first feature always starts from
    the left edge of the media rail. Closing a feature still uses
    the existing centred-focus behaviour.
  */
  resetInitialRailToStart();

  window.addEventListener("pageshow", () => {
    resetInitialRailToStart();
  });

  document.fonts?.ready?.then(() => {
    measureClosedWidths();
    resetInitialRailToStart();
  });
}

/* ================================================================
   PRESENTATION IMAGE LIGHTBOX
   ================================================================ */

function setupPresentationImageLightbox() {
  const triggers = Array.from(
    document.querySelectorAll(".presentation-card__image"),
  );

  const lightbox = document.querySelector(".image-lightbox");

  const image = lightbox?.querySelector(".image-lightbox__image");

  const closeButton = lightbox?.querySelector(".image-lightbox__close");

  if (!triggers.length || !lightbox || !image) {
    return;
  }

  let previousOverflow = "";
  let lastFocusedElement = null;
  let lightboxBackground = [];
  let clearImageTimer;

  const openLightbox = (trigger) => {
    const currentSrc = trigger.currentSrc || trigger.src;

    if (!currentSrc) {
      return;
    }

    clearTimeout(clearImageTimer);
    lightboxBackground = Array.from(document.body.children)
      .filter(
        (element) => element !== lightbox && element instanceof HTMLElement,
      )
      .map((element) => ({ element, inert: element.inert }));
    lightboxBackground.forEach(({ element }) => {
      element.inert = true;
    });
    image.src = currentSrc;
    image.alt = trigger.alt
      ? `${trigger.alt} ampliada`
      : "Apresentação Vellure Lift Lido ampliada";

    lastFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : trigger;

    previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    lightbox.inert = false;

    lightbox.setAttribute("aria-hidden", "false");

    lightbox.classList.add("is-open");

    document.dispatchEvent(
      new CustomEvent("product-image-lightbox-change", {
        detail: {
          open: true,
        },
      }),
    );

    requestAnimationFrame(() => {
      closeButton?.focus({
        preventScroll: true,
      });
    });
  };

  const closeLightbox = () => {
    if (!lightbox.classList.contains("is-open")) {
      return;
    }

    lightbox.classList.remove("is-open");

    lightbox.setAttribute("aria-hidden", "true");

    lightbox.inert = true;
    lightboxBackground.forEach(({ element, inert }) => {
      element.inert = inert;
    });
    lightboxBackground = [];

    document.dispatchEvent(
      new CustomEvent("product-image-lightbox-change", {
        detail: {
          open: false,
        },
      }),
    );

    document.body.style.overflow = previousOverflow;

    clearImageTimer = window.setTimeout(
      () => {
        image.removeAttribute("src");
      },
      prefersReducedMotion.matches ? 0 : 220,
    );

    lastFocusedElement?.focus?.({
      preventScroll: true,
    });
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openLightbox(trigger);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openLightbox(trigger);
    });
  });

  lightbox.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeImageLightbox === "true") {
      closeLightbox();
    }
  });

  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
      return;
    }

    if (event.key === "Tab" && closeButton) {
      event.preventDefault();
      closeButton.focus();
    }
  });
}

/* ================================================================
   INITIALIZE
   ================================================================ */

[
  setupResponsiveExperience,
  setupTechCarousel,
  setupNeedleSwitch,
  setupIndicationArticleReveals,
  setupScienceCopyReveals,
  setupFaqAccordion,
  initDetails,
  setupScienceMetric,
  setupBackToTop,
  setupMobileFeatureShowcase,
  setupPresentationImageLightbox,
  setupStaticFinalFeatureAnchors,
].forEach((initialize) => {
  try {
    initialize();
  } catch (error) {
    console.error(`Failed to initialize ${initialize.name}`, error);
  }
});

/* ================================================================
   VIDEO PLAY / PAUSE TOGGLES
   Compact visual controls positioned over the video viewport.
   Accessible text remains synchronized with playback state.
   ================================================================ */

function setupVideoPlaybackToggles() {
  const buttons = Array.from(
    document.querySelectorAll(".video-playback-toggle[aria-controls]"),
  );

  buttons.forEach((button) => {
    const playerId = button.getAttribute("aria-controls");

    const player = playerId ? document.getElementById(playerId) : null;

    if (!(player instanceof HTMLVideoElement)) {
      return;
    }

    const sync = () => {
      const isPlaying = !player.paused && !player.ended;

      const label = isPlaying ? "Pausar vídeo" : "Reproduzir vídeo";

      button.dataset.state = isPlaying ? "playing" : "paused";

      button.textContent = label;

      button.setAttribute("aria-label", label);

      button.setAttribute("title", label);

      button.hidden =
        !player.getAttribute("src") || player.style.display === "none";
    };

    button.addEventListener("click", () => {
      if (
        player.ended ||
        (Number.isFinite(player.duration) &&
          player.duration > 0 &&
          player.currentTime >= player.duration - 0.08)
      ) {
        player.currentTime = 0;
      }

      if (player.paused) {
        player.play().catch(() => {});
      } else {
        player.pause();
      }
    });

    [
      "play",
      "playing",
      "pause",
      "ended",
      "emptied",
      "loadedmetadata",
      "error",
    ].forEach((eventName) => {
      player.addEventListener(eventName, sync);
    });

    new MutationObserver(sync).observe(player, {
      attributes: true,
      attributeFilter: ["src", "style"],
    });

    sync();
  });
}

try {
  setupVideoPlaybackToggles();
} catch (error) {
  console.error("Failed to initialize video playback toggles", error);
}

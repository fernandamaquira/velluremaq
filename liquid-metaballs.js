import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const MOBILE_MAX = 734;
const TABLET_MAX = 1068;

export function initLiquidMetaballs() {
  const container = document.querySelector(".liquid-3d");

  if (!container || !window.WebGLRenderingContext) {
    throw new Error("WebGL is unavailable.");
  }

  const disposers = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of disposers.reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.warn("Liquid cleanup failed", error);
      }
    }
  };
  const own = (resource) => {
    disposers.push(() => resource.dispose());
    return resource;
  };
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    disposers.push(() => {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    });
    renderer.setClearColor(0x0d0c0e, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    const environmentGenerator = own(new THREE.PMREMGenerator(renderer));
    const room = own(new RoomEnvironment());
    const environmentTarget = own(environmentGenerator.fromScene(room, 0.04));
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.4;

    const material = own(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.1,
        transmission: 1,
        thickness: 0.1,
        ior: 1.2,
        attenuationColor: 0xe7a1b9,
        attenuationDistance: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.01,
      }),
    );
    const isMobile = window.innerWidth <= MOBILE_MAX;
    const mobileScene = {
      compact: { ballY: -0.08, liquidY: -0.08, scale: 0.9, titleY: -0.04 },
      tall: { ballY: -0.08, liquidY: -0.05, scale: 1.02, titleY: -0.26 },
    };
    let mobileBallYOffset = mobileScene.compact.ballY;
    const resolution = isMobile ? 64 : 88;
    const liquid = new MarchingCubes(resolution, material, true, false, 100000);
    own(liquid.geometry);
    liquid.scale.set(2.05, 2.05, 1.05);
    scene.add(liquid);

    scene.add(new THREE.HemisphereLight(0xf9ecf3, 0x010101, 1.8));
    const keyLight = new THREE.PointLight(0xffffff, 30, 8);
    keyLight.position.set(-2.4, 2.6, 3.2);
    scene.add(keyLight);
    const pinkLight = new THREE.PointLight(0xf4abc9, 14, 7);
    pinkLight.position.set(2.8, -1.6, 2.4);
    scene.add(pinkLight);

    const titleCanvas = document.createElement("canvas");
    titleCanvas.width = 1600;
    titleCanvas.height = 1000;
    const titleContext = titleCanvas.getContext("2d");
    const isTablet = !isMobile && window.innerWidth <= TABLET_MAX;

    const titleFont = isMobile
      ? '300 120px "Blauer Nue", sans-serif'
      : isTablet
        ? '300 135px "Blauer Nue", sans-serif'
        : '300 150px "Blauer Nue", sans-serif';
    const paintTitle = () => {
      titleContext.fillStyle = "#1d1a1f";
      titleContext.fillRect(0, 0, titleCanvas.width, titleCanvas.height);
      titleContext.fillStyle = "#fdfdfd75";
      titleContext.font = titleFont;
      titleContext.textAlign = "center";
      titleContext.textBaseline = "middle";
      const titleBlock = isMobile
        ? { centerY: 305, lineGap: 90 }
        : isTablet
          ? { centerY: 455, lineGap: 122 }
          : { centerY: 477.5, lineGap: 145 };
      titleContext.fillText(
        "Alta",
        titleCanvas.width / 2,
        titleBlock.centerY - titleBlock.lineGap / 2,
      );
      titleContext.fillText(
        "Performance",
        titleCanvas.width / 2,
        titleBlock.centerY + titleBlock.lineGap / 2,
      );
    };
    paintTitle();
    const titleTexture = own(new THREE.CanvasTexture(titleCanvas));
    document.fonts?.ready?.then(() => {
      if (disposed) return;
      paintTitle();
      titleTexture.needsUpdate = true;
    });
    titleTexture.colorSpace = THREE.SRGBColorSpace;
    const titlePlane = new THREE.Mesh(
      own(
        new THREE.PlaneGeometry(
          isMobile ? 2.65 : isTablet ? 3.8 : 4.9,
          isMobile ? 1.66 : isTablet ? 2.37 : 3.06,
        ),
      ),
      own(new THREE.MeshBasicMaterial({ map: titleTexture })),
    );
    titlePlane.position.z = -1.25;
    titlePlane.position.y = isMobile ? 0.58 : 0;
    titlePlane.renderOrder = -1;
    liquid.renderOrder = 1;
    scene.add(titlePlane);

    const flowBlobs = [
      {
        base: new THREE.Vector3(0.43, 0.57, 0.5),
        position: new THREE.Vector3(0.43, 0.57, 0.5),
        radius: 0.46,
        phase: 0,
      },
      {
        base: new THREE.Vector3(0.55, 0.51, 0.51),
        position: new THREE.Vector3(0.55, 0.51, 0.51),
        radius: 0.38,
        phase: 0.8,
      },
      {
        base: new THREE.Vector3(0.51, 0.4, 0.49),
        position: new THREE.Vector3(0.51, 0.4, 0.49),
        radius: 0.31,
        phase: 1.7,
      },
      {
        base: new THREE.Vector3(0.66, 0.37, 0.53),
        position: new THREE.Vector3(0.66, 0.37, 0.53),
        radius: 0.16,
        phase: 2.5,
      },
      {
        base: new THREE.Vector3(0.27, 0.38, 0.48),
        position: new THREE.Vector3(0.27, 0.38, 0.48),
        radius: 0.18,
        phase: 3.2,
      },
      {
        base: new THREE.Vector3(0.46, 0.76, 0.52),
        position: new THREE.Vector3(0.46, 0.76, 0.52),
        radius: 0.17,
        phase: 4.1,
      },
    ];
    const pointer = new THREE.Vector3(0.5, 0.5, 0.54);
    const pulledBlob = {
      position: new THREE.Vector3(0.5, 0.5, 0.54),
      target: new THREE.Vector3(0.5, 0.5, 0.54),
      rest: new THREE.Vector3(0.54, 0.5, 0.54),
      active: false,
    };
    const clock = new THREE.Clock();
    let animationFrameId = null;
    let isSectionActive = false;
    let isDocumentVisible = !document.hidden;

    function resize() {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height || disposed) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      const isCompactViewport = width <= MOBILE_MAX;
      const isTabletViewport = width > MOBILE_MAX && width <= TABLET_MAX;
      const isTallMobile = isCompactViewport && height / width > 1.45;
      const profile = isTallMobile ? mobileScene.tall : mobileScene.compact;

      const scale = isCompactViewport
        ? profile.scale
        : isTabletViewport
          ? 1.58
          : 2.05;

      mobileBallYOffset = isCompactViewport ? profile.ballY : 0;

      liquid.scale.set(scale, scale, scale * 0.51);

      liquid.position.y = isCompactViewport
        ? profile.liquidY
        : isTabletViewport
          ? -0.02
          : 0;

      titlePlane.position.y = isCompactViewport
        ? profile.titleY
        : isTabletViewport
          ? 0.03
          : 0;
    }

    function updatePointer(event) {
      const bounds = container.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        (0.5 - (event.clientY - bounds.top) / bounds.height) * 2,
        0.54,
      );
      pulledBlob.target.set(
        THREE.MathUtils.clamp(pointer.x * 0.5 + 0.5, 0.05, 0.95),
        THREE.MathUtils.clamp(pointer.y * 0.5 + 0.5, 0.05, 0.95),
        0.54,
      );
      pulledBlob.active = true;
    }

    function animate() {
      if (disposed || !isSectionActive || !isDocumentVisible) {
        animationFrameId = null;
        return;
      }

      const elapsed = clock.getElapsedTime();
      const mobileYOffset =
        window.innerWidth <= MOBILE_MAX ? mobileBallYOffset : 0;

      liquid.reset();

      flowBlobs.forEach((blob) => {
        const targetX =
          blob.base.x + Math.cos(elapsed * 0.16 + blob.phase) * 0.028;
        const targetY =
          blob.base.y + Math.sin(elapsed * 0.14 + blob.phase) * 0.028;
        const targetZ =
          blob.base.z + Math.sin(elapsed * 0.2 + blob.phase) * 0.018;

        blob.position.x += (targetX - blob.position.x) * 0.008;
        blob.position.y += (targetY - blob.position.y) * 0.008;
        blob.position.z += (targetZ - blob.position.z) * 0.008;

        liquid.addBall(
          blob.position.x,
          blob.position.y + mobileYOffset,
          blob.position.z,
          blob.radius,
          24,
        );
      });

      if (pulledBlob.active) {
        pulledBlob.position.lerp(pulledBlob.target, 0.012);
      } else {
        pulledBlob.position.lerp(pulledBlob.rest, 0.0045);
      }

      liquid.addBall(
        pulledBlob.position.x,
        pulledBlob.position.y + mobileYOffset,
        pulledBlob.position.z,
        0.3,
        24,
      );

      liquid.rotation.z = Math.sin(elapsed * 0.25) * 0.045;
      liquid.update();
      renderer.render(scene, camera);

      animationFrameId = requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (animationFrameId !== null || !isSectionActive || !isDocumentVisible) {
        return;
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    function stopAnimation() {
      if (animationFrameId === null) return;

      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    const scienceSection = container.closest(".science-section");
    scienceSection?.classList.add("has-liquid-canvas");
    disposers.push(() => {
      stopAnimation();
      scienceSection?.classList.remove("has-liquid-canvas");
      container.classList.remove("is-interacting");
    });

    const releasePointer = (event) => {
      pulledBlob.active = false;
      container.classList.remove("is-interacting");
      if (
        event?.pointerId !== undefined &&
        container.hasPointerCapture?.(event.pointerId)
      ) {
        container.releasePointerCapture(event.pointerId);
      }
    };

    const beginInteraction = (event) => {
      event.preventDefault();
      container.classList.add("is-interacting");
      container.setPointerCapture?.(event.pointerId);
      updatePointer(event);
    };

    const moveInteraction = (event) => {
      // Desktop is hover-driven: the liquid follows the pointer immediately.
      if (event.pointerType !== "touch") {
        updatePointer(event);
        return;
      }

      // Touch remains intentional drag interaction so ordinary page scrolls
      // do not continually pull the liquid around.
      if (!pulledBlob.active) return;
      event.preventDefault();
      updatePointer(event);
    };

    // The liquid surface owns its drag gesture. `touch-action: none` in CSS
    // stops Safari from turning that gesture into a page scroll.
    listen(container, "pointerdown", beginInteraction, {
      passive: false,
    });
    listen(container, "pointermove", moveInteraction, {
      passive: false,
    });
    listen(container, "pointerup", releasePointer, { passive: true });
    listen(container, "pointercancel", releasePointer, {
      passive: true,
    });
    listen(container, "pointerleave", releasePointer, {
      passive: true,
    });
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isSectionActive = Boolean(entry?.isIntersecting);

        if (isSectionActive) {
          startAnimation();
        } else {
          stopAnimation();
        }
      },
      {
        root: null,
        rootMargin: "30% 0px 30% 0px",
        threshold: 0.01,
      },
    );

    disposers.push(() => visibilityObserver.disconnect());
    visibilityObserver.observe(scienceSection || container);

    const handleVisibilityChange = () => {
      isDocumentVisible = !document.hidden;

      if (isDocumentVisible && isSectionActive) {
        startAnimation();
      } else {
        stopAnimation();
      }
    };

    listen(document, "visibilitychange", handleVisibilityChange);

    listen(window, "resize", resize);

    resize();

    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}

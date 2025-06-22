/**
 * Experience 类 - 三维交互体验的核心控制器
 * 
 * 主要功能:
 * 1. 创建和管理Three.js场景、相机和渲染器
 * 2. 与GSAP的ScrollSmoother和ScrollTrigger集成，实现平滑滚动效果
 * 3. 创建动态的3D元素并响应滚动事件
 * 4. 管理动画和渲染循环
 * 
 * 工作原理:
 * - 初始化时创建Three.js场景并添加3D元素(立方体)
 * - 通过GSAP的ScrollSmoother实现平滑滚动
 * - 使用ScrollTrigger监听文本元素，并在滚动时更新它们的视觉效果
 * - 随着页面滚动，相机位置和3D元素会动态变化
 * - 所有3D元素都有自己的旋转速度，创建生动的背景效果
 * 
 * 在整个应用中，Experience负责将2D文本内容与3D背景融合，
 * 创造出随着用户滚动而变化的沉浸式体验。
 */

function processLyrics() {
  const lyricsElement = document.getElementById('lyrics');
  const text = lyricsElement.innerHTML;

  // 按行分割文本，保留空行
  const lines = text.split('\n').map(line => line.trim());

  // 在开头和结尾添加空行，使第一行歌词居中
  const emptyLines = Array(10).fill('<div class="text-line"></div>');


  // 创建新的HTML结构
  const contentLines = lines.map(line => {
    if (line === '') {
      return '<br />'; // 空行转换为段落分隔
    } else if (line.length > 0) {
      return `<div class="text-line">${line}</div>`;
    }
    return '';
  }).filter(line => line !== '');

  // 在歌词前后添加空行
  const processedHTML = [
    ...emptyLines,
    ...contentLines,
    ...emptyLines
  ].join('\n');

  lyricsElement.innerHTML = processedHTML;
}

// 在DOM加载完成后处理歌词
document.addEventListener('DOMContentLoaded', processLyrics);

// 动态字体大小控制
function updateTextSizes() {
  const screenCenterY = window.innerHeight / 2;
  const textLines = document.querySelectorAll('.text-line');

  let closestLine = null;
  let minDistance = Infinity;

  // 找到距离屏幕中心最近的文本行
  textLines.forEach(line => {
    const rect = line.getBoundingClientRect();
    const lineCenterY = rect.top + rect.height / 2;
    const distance = Math.abs(lineCenterY - screenCenterY);

    if (distance < minDistance) {
      minDistance = distance;
      closestLine = line;
    }
  });

  // 为所有文本行设置大小
  textLines.forEach(line => {
    if (line === closestLine) {
      // 最靠近中心的行：根据距离调整大小
      const rect = line.getBoundingClientRect();
      const lineCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(lineCenterY - screenCenterY);

      // 使用更大的影响范围，让变化更平滑
      const maxDistance = window.innerHeight * 0.3;
      const normalizedDistance = Math.min(distance / maxDistance, 1);

      // 使用更平滑的缓动函数
      const smoothFactor = Math.cos(normalizedDistance * Math.PI / 2);
      const fontSize = 1.2 + (smoothFactor * 1.3); // 1.2em 到 2.5em

      gsap.to(line, {
        fontSize: fontSize + 'em',
        duration: 0.4,
        ease: 'power1.out'
      });
    } else {
      // 其他行保持默认大小
      gsap.to(line, {
        fontSize: '1.2em',
        duration: 0.4,
        ease: 'power1.out'
      });
    }
  });
}

// 使用节流函数优化性能
let ticking = false;
function requestTick() {
  if (!ticking) {
    requestAnimationFrame(updateTextSizes);
    ticking = true;
  }
}

function handleScroll() {
  ticking = false;
  requestTick();
}

// 初始化和事件监听
window.addEventListener('load', updateTextSizes);
window.addEventListener('scroll', handleScroll, { passive: true });
window.addEventListener('resize', updateTextSizes);



class Experience {
  constructor(
    options = {
      containerSelector: "[data-app-container]"
    }
  ) {
    this.options = options;
    this.container = document.querySelector(this.options.containerSelector);

    // GSAP Plugins
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    // Time
    this.clock = new THREE.Clock();
    this.time = 0;

    // THREE items
    this.renderer;
    this.camera;
    this.scene;
    this.controls;
    this.meshes = [];

    // Rotation
    this.targetRotation = 0;

    // Settings
    this.settings = {
      cameraDistance: 5,
      scalePeriod: 8
    };

    this.init();
  }

  init = () => {
    this.createApp();
    this.createItems();
    this.initScroll();
    this.update();

    this.container.classList.add("is-ready");
  };

  initScroll = () => {
    this.scrollSmoother = ScrollSmoother.create({
      content: "#content",
      smooth: 1.2
    });

    // Add scroll triggers for each span item
    document.querySelectorAll("span").forEach((span) => {
      ScrollTrigger.create({
        trigger: span,
        start: "top 90%",
        end: "bottom 10%",
        onUpdate: (self) => {
          const dist = Math.abs(self.progress - 0.5);
          const lightness = this.mapToRange(dist, 0, 0.5, 80, 100);
          span.style.setProperty("--l", lightness + "%");
        }
      });
    });
  };

  createApp = () => {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true
    });
    this.renderer.setPixelRatio(1.5);
    this.renderer.setSize(
      this.container.offsetWidth,
      this.container.offsetHeight
    );
    this.container.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.offsetWidth / this.container.offsetHeight,
      1,
      10000
    );
    this.camera.position.set(0, 0, this.settings.cameraDistance);
    this.scene = new THREE.Scene();

    // Orbit Controls
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.enableKeys = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = false;

    // Resize the renderer on window resize
    window.addEventListener(
      "resize",
      () => {
        this.camera.aspect =
          this.container.offsetWidth / this.container.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(
          this.container.offsetWidth,
          this.container.offsetHeight
        );
      },
      true
    );

    // Ambient Light
    let ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambientLight);

    // Directional Light
    let directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 3, 2);
    directionalLight.target.position.set(0, 0, 0);
    this.scene.add(directionalLight);
  };

  createItems = () => {
    // Box
    let boxGeom = new THREE.BoxBufferGeometry(2, 2, 2);
    let material = new THREE.MeshLambertMaterial({
      color: 0xffffff
    });

    const itemCount = 40;
    for (let i = 0; i < itemCount; i++) {
      const mesh = new THREE.Mesh(boxGeom, material);
      mesh.position.y = 13 * (Math.random() * 2 - 1);
      mesh.position.x = 3 * (Math.random() * 2 - 1);
      mesh.position.z = 4 * (Math.random() * 2 - 1);
      mesh.rotation.y = Math.PI * Math.random();
      mesh.rotationSpeed = Math.random() * 0.01 + 0.005;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  };

  updateItems = () => {
    const time = this.time;
    const amplitude = 0.05;
    const period = this.settings.scalePeriod;

    const baseScale = 0.2;
    const scaleEffect =
      baseScale + amplitude * Math.sin(Math.PI * 2 * (time / period));

    this.meshes.forEach((mesh) => {
      mesh.scale.set(scaleEffect, scaleEffect, scaleEffect);

      // Update rotation
      mesh.rotation.x += mesh.rotationSpeed;
    });

    // Update camera
    const cameraRange = 10;
    this.camera.position.y = this.mapToRange(
      this.scrollSmoother.progress,
      0,
      1,
      cameraRange,
      -cameraRange
    );
  };

  mapToRange = (value, inMin, inMax, outMin, outMax) => {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  };

  update = () => {
    this.time = this.clock.getElapsedTime();

    this.updateItems();

    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.update);
  };
}

new Experience();


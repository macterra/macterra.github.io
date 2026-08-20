import { Lattice } from "./scene";

const cursor = document.querySelector("#cursor") as HTMLElement | null;
const hero = document.querySelector(".hero") as HTMLElement | null;
const pointer = { x: 0, y: 0 };

window.addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerType === "touch") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (cursor) cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    if (hero) {
      hero.style.setProperty("--px", pointer.x.toFixed(3));
      hero.style.setProperty("--py", pointer.y.toFixed(3));
    }
  },
  { passive: true },
);

function bindJournal(): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bar = document.querySelector(".bar") as HTMLElement | null;
  const sections = Array.from(document.querySelectorAll("main section[id]"));
  const navLinks = Array.from(document.querySelectorAll("nav a"));

  if (reduced) {
    for (const s of sections) s.classList.add("is-in");
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" },
    );
    for (const s of sections) io.observe(s);
    window.setTimeout(() => {
      for (const s of sections) s.classList.add("is-in");
    }, 4000);
  }

  const spy = (): void => {
    let current = "";
    for (const s of sections) {
      if (s.getBoundingClientRect().top < window.innerHeight * 0.42) current = s.id;
    }
    for (const a of navLinks) {
      a.classList.toggle("is-here", a.getAttribute("href") === `#${current}`);
    }
    if (hero && bar) {
      bar.classList.toggle("is-solid", hero.getBoundingClientRect().bottom < 72);
    }
  };
  window.addEventListener("scroll", spy, { passive: true });
  spy();

  for (const card of document.querySelectorAll(".cards article")) {
    const el = card as HTMLElement;
    el.addEventListener("pointermove", (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--lx", `${e.clientX - r.left}px`);
      el.style.setProperty("--ly", `${e.clientY - r.top}px`);
    });
  }
}

async function boot(): Promise<void> {
  bindJournal();
  const canvas = document.querySelector("#gl") as HTMLCanvasElement;
  const lattice = await Lattice.create(canvas);
  document.documentElement.classList.add("is-ready");
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lattice.frame(dt, pointer.x, pointer.y);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  document.documentElement.classList.add("is-ready");
  document.body.insertAdjacentHTML("beforeend", `<pre class="now">${String(err)}</pre>`);
});

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

async function boot(): Promise<void> {
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

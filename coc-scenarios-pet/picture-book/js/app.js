(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = {
    pet: "dog",
    page: "cover",
    view: "all",
    note: true,
    busy: false,
  };
  const status = $("status");
  let readiness = Promise.resolve();
  let generation = 0;
  let focusedSlot = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function image(src, className, alt = "") {
    const node = element("img", className);
    node.src = src;
    node.alt = alt;
    node.draggable = false;
    return node;
  }

  function chooseNextPet(pageId, slotIndex) {
    if (state.busy) return;
    const ids = Object.keys(Book.pets);
    state.pet = ids[(ids.indexOf(state.pet) + 1) % ids.length];
    focusedSlot = { pageId, slotIndex };
    render();
  }

  // Compose one half-page from independent decoration, illustration, pet and text layers.
  function leaf(page, printable = false) {
    const node = element("article", "leaf");
    if (!page) return node;
    node.dataset.page = page.id;
    node.setAttribute("aria-label", `${page.id} ${page.label}`);
    if (page.decoration) node.append(image(page.decoration, "page-decoration"));
    if (page.storyWash) node.append(image(page.storyWash, "story-wash"));
    node.classList.toggle("sample", Boolean(page.sample));
    if (page.id === "N") {
      node.append(element("div", "note-content", page.paragraphs[0]));
      return node;
    }
    const isCover = page.id === "cover";
    const isInk = ["11", "12"].includes(page.id);
    node.classList.toggle("cover", isCover);
    node.classList.toggle("ink", isInk);
    node.classList.toggle("reverse", page.id === "12");
    node.classList.toggle(
      "short",
      !isCover && !isInk && page.paragraphs.join("").length < 85,
    );
    if (isCover) node.append(element("h2", "", page.paragraphs[0]));
    const art = element("div", "illustration");
    if (page.background) art.append(image(page.background, "background"));
    for (const [slotIndex, slot] of page.slots.entries()) {
      if (page.effect) {
        const effect = image(`assets/effects/${page.effect}.svg`, "effect");
        Object.assign(effect.style, {
          left: slot.x + "%",
          top: slot.y - 3 + "%",
          width: slot.width * 1.65 + "%",
        });
        art.append(effect);
      }
      const pet = element(printable ? "span" : "button", "pet");
      if (!printable) {
        pet.type = "button";
        pet.setAttribute("aria-label", "更换宠物：当前" + Book.pets[state.pet]);
        pet.addEventListener("click", () => chooseNextPet(page.id, slotIndex));
      }
      Object.assign(pet.style, {
        left: slot.x + "%",
        top: slot.y + "%",
        width: Math.abs(slot.width) + "%",
      });
      if (slot.width < 0) pet.classList.add("flipped");
      pet.append(
        image(Book.petAsset(state.pet, slot), "", Book.pets[state.pet]),
      );
      art.append(pet);
    }
    if (page.foreground) {
      const prop = image(page.foreground, "foreground positioned-prop");
      const placement = PropLayout.bin[page.id];
      Object.assign(prop.style, {
        left: placement.x + "%",
        top: placement.y + "%",
        width: Math.abs(placement.width) + "%",
      });
      if (placement.width < 0) prop.classList.add("flipped");
      art.append(prop);
    }
    if (page.ink) {
      const ink = image(page.ink, "ink-mark positioned-prop");
      const placement = PropLayout.ink[page.id];
      Object.assign(ink.style, {
        left: placement.x + "%",
        top: placement.y + "%",
        width: Math.abs(placement.width) + "%",
      });
      if (placement.width < 0) ink.classList.add("flipped");
      art.append(ink);
    }
    node.append(art);
    if (isCover)
      node.append(element("p", "cover-caption", "一个关于寻找的故事"));
    else if (!isInk) {
      const story = element("div", "story");
      page.paragraphs.forEach((text) => story.append(element("p", "", text)));
      node.append(story);
      node.append(element("div", "ornament", "·  ✧  ·"));
    }
    if (!isCover) node.append(element("span", "folio", page.id));
    return node;
  }

  function sheets(pages, printable) {
    const fragment = document.createDocumentFragment();
    for (const pair of Book.sheets(pages)) {
      const sheet = element("section", "sheet");
      pair.forEach((page) => sheet.append(leaf(page, printable)));
      sheet.append(element("span", "cut"), element("span", "cut bottom"));
      fragment.append(sheet);
    }
    return fragment;
  }

  // Confirm every referenced image decodes before offering the book for printing.
  async function loadAssets(pages, pet) {
    const paths = [...new Set(pages.flatMap((page) => Book.assets(page, pet)))];
    const results = await Promise.all(
      paths.map(async (src) => {
        const img = new Image();
        img.src = src;
        try {
          await img.decode();
          return null;
        } catch {
          return src;
        }
      }),
    );
    const missing = results.filter(Boolean);
    if (missing.length) throw new Error("素材加载失败：" + missing.join("、"));
    await document.fonts.ready;
  }

  // Preview and hidden print sheets are built from the same page data and layout.
  function render() {
    $("view").value = state.view;
    const pages = Book.pages(state.pet, state.note);
    if (!pages.some((p) => p.id === state.page)) state.page = "cover";
    document.title = pages[0].paragraphs[0] + " · 绘本工作台";
    $("pets")
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.pet === state.pet)),
      );
    $("page").replaceChildren(
      ...pages.map((page) => {
        const option = element("option", "", `${page.id} · ${page.label}`);
        option.value = page.id;
        return option;
      }),
    );
    $("page").value = state.page;
    const current = pages.find((page) => page.id === state.page);
    $("preview").replaceChildren();
    if (state.view === "all") $("preview").append(sheets(pages, false));
    else {
      const node = leaf(current);
      node.classList.add("single-leaf");
      $("preview").append(node);
    }
    $("print-root").replaceChildren(sheets(pages, true));
    if (focusedSlot) {
      const { pageId, slotIndex } = focusedSlot;
      $("preview")
        .querySelector(`[data-page="${pageId}"]`)
        ?.querySelectorAll(".pet")
        [slotIndex]?.focus({ preventScroll: true });
      focusedSlot = null;
    }
    const index = pages.indexOf(current);
    $("page-label").textContent =
      `${current.id} · ${current.label} / ${pages.length} 页`;
    $("previous").disabled = index === 0;
    $("next").disabled = index === pages.length - 1;
    const token = ++generation;
    status.className = "";
    status.textContent = "正在准备插画与文字…";
    readiness = loadAssets(pages, state.pet)
      .then(() => {
        if (token === generation)
          status.textContent = `${Book.pets[state.pet]}版已就绪 · 7 张 A4 · 点击画面中的宠物也可切换`;
        return true;
      })
      .catch((error) => {
        if (token === generation) {
          status.className = "error";
          status.textContent = error.message;
        }
        return false;
      });
  }

  // A separate document receives only finished sheets and the book stylesheet.
  async function print(mode) {
    if (state.busy) return;
    // Open synchronously from the click so browsers do not treat it as an unsolicited popup.
    const output = window.open("", "_blank");
    if (!output) {
      status.className = "error";
      status.textContent = "打印窗口被拦截，请允许本站弹窗后重试。";
      return;
    }
    state.busy = true;
    const controls = [
      ...document.querySelectorAll(
        ".workbench-container button, .workbench-container select, .workbench-container input, .reader-container button, .reader-container select",
      ),
    ];
    controls.forEach((node) => {
      node.disabled = true;
    });
    try {
      if (!(await readiness))
        throw new Error("请先修复上方素材加载错误，再打印。");
      const pages = Book.pages(state.pet, state.note);
      $("print-root").replaceChildren(
        sheets(mode === "current" ? pages.filter((p) => p.id === state.page) : pages, true),
      );
      const doc = output.document;
      doc.documentElement.lang = "zh-CN";
      doc.title = pages[0].paragraphs[0];
      const base = doc.createElement("base");
      base.href = document.baseURI;
      const stylesheet = doc.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = new URL("css/book.css?v=1", document.baseURI).href;
      const styled = new Promise((resolve, reject) => {
        stylesheet.onload = resolve;
        stylesheet.onerror = () =>
          reject(new Error("打印样式加载失败，请重试。"));
      });
      doc.head.append(base, stylesheet);
      doc.body.className = "print-document";
      doc.body.dataset.bookFont = $("font").value;
      // Import only completed book sheets, never any workbench controls.
      doc.body.replaceChildren(
        ...[...$("print-root").children].map((node) =>
          doc.importNode(node, true),
        ),
      );
      await styled;
      await Promise.all([...doc.images].map((img) => img.decode()));
      await doc.fonts.ready;
      await new Promise((resolve) =>
        output.requestAnimationFrame(() =>
          output.requestAnimationFrame(resolve),
        ),
      );
      output.focus();
      output.print();
    } catch (error) {
      if (!output.closed) output.close();
      status.className = "error";
      status.textContent = error.message;
    } finally {
      $("print-root").replaceChildren(
        sheets(Book.pages(state.pet, state.note), true),
      );
      state.busy = false;
      controls.forEach((node) => {
        node.disabled = false;
      });
      const pages = Book.pages(state.pet, state.note);
      const index = pages.findIndex((page) => page.id === state.page);
      $("previous").disabled = index === 0;
      $("next").disabled = index === pages.length - 1;
    }
  }

  Object.entries(Book.pets).forEach(([id, label]) => {
    const button = element("button", "workbench-pet-choice");
    button.dataset.pet = id;
    button.append(
      image(`assets/pets/${id}/healthy-back.png`, ""),
      element("span", "", label),
    );
    button.addEventListener("click", () => {
      state.pet = id;
      render();
    });
    $("pets").append(button);
  });
  $("view").addEventListener("change", (event) => {
    state.view = event.target.value;
    render();
  });
  $("font").addEventListener("change", (event) => {
    document.body.dataset.bookFont = event.target.value;
  });
  function revealCurrentPage() {
    if (state.view === "all") {
      $("preview")
        .querySelector(`[data-page="${state.page}"]`)
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  $("page").addEventListener("change", (event) => {
    state.page = event.target.value;
    render();
    revealCurrentPage();
  });
  $("note").addEventListener("change", (event) => {
    state.note = event.target.checked;
    render();
  });
  for (const [id, step] of [
    ["previous", -1],
    ["next", 1],
  ]) {
    $(id).addEventListener("click", () => {
      const pages = Book.pages(state.pet, state.note);
      const next = pages[pages.findIndex((p) => p.id === state.page) + step];
      if (next) {
        state.page = next.id;
        render();
        revealCurrentPage();
      }
    });
  }
  $("print-all").addEventListener("click", () => print("all"));
  $("print-page").addEventListener("click", () => print("current"));
  // Restore full-book defaults after dialog close; native Ctrl/Cmd+P prints the whole book.
  window.addEventListener("afterprint", () => {
    $("print-root").replaceChildren(
      sheets(Book.pages(state.pet, state.note), true),
    );
  });
  document.body.dataset.bookFont = $("font").value;
  render();
})();

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../picture-book');
const context = vm.createContext({});
for (const file of ['data.js', 'pet-layout.js', 'prop-layout.js', 'book.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}
const book = context.Book;

test('public entry and print window reference the reorganized runtime files', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const file of ['js/data.js', 'js/pet-layout.js', 'js/prop-layout.js', 'js/book.js']) {
    assert.ok(html.includes(`"${file}`), file);
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
  assert.ok(html.includes('"js/app.js?v=6"'));
  assert.ok(fs.existsSync(path.join(root, 'js/app.js')));
  for (const stylesheet of ['css/page.css?v=1', 'css/book.css?v=1']) {
    assert.ok(html.includes(`"${stylesheet}"`));
    assert.ok(fs.existsSync(path.join(root, stylesheet.split('?')[0])));
  }
  assert.equal(fs.existsSync(path.join(root, 'css/styles.css')), false);
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.ok(app.includes('new URL("css/book.css?v=1", document.baseURI)'));
  const pageCss = fs.readFileSync(path.join(root, 'css/page.css'), 'utf8');
  const bookCss = fs.readFileSync(path.join(root, 'css/book.css'), 'utf8');
  assert.match(pageCss, /\.workbench-container\s*\{/);
  assert.doesNotMatch(pageCss, /@font-face|@page|\.page-decoration\s*\{/);
  assert.match(bookCss, /@font-face|@page/);
  assert.doesNotMatch(bookCss, /\.workbench-pet-choice\s*\{/);
  for (const privateDirectory of ['scripts', 'tests', 'refs', 'source']) {
    assert.equal(fs.existsSync(path.join(root, privateDirectory)), false);
  }
});

test('Long Cang is the default text font while Noto Serif remains selectable', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/book.css'), 'utf8');
  assert.match(html, /<option value="longcang" selected>/);
  assert.equal((html.match(/<option[^>]* selected>/g) || []).filter(option => /value="(?:noto|xiaowei|longcang|qingke|mashan|zhimang|liujian|kuaile|sans)"/.test(option)).length, 1);
  assert.match(css, /body \{\s*--book-font: "Long Cang", "Noto Serif SC", serif;/);
  assert.match(css, /body\[data-book-font="noto"\] \{\s*--book-font: "Noto Serif SC"/);
});

test('editable layout config controls each species and every page slot', () => {
  for (const animal of ['dog', 'cat', 'bird']) {
    const layouts = context.PetLayout[animal];
    assert.deepEqual(Object.keys(layouts).sort(), ['cover', ...Array.from({length: 10}, (_, i) => String(i + 1).padStart(2, '0'))].sort());
    for (const page of book.pages(animal, false).filter(page => page.slots.length)) {
      assert.equal(layouts[page.id].length, page.slots.length);
      page.slots.forEach((slot, index) => {
        for (const key of ['x', 'y', 'width']) assert.equal(slot[key], layouts[page.id][index][key]);
      });
    }
  }
  const placement = context.PetLayout.cat['03'][1];
  const original = placement.x;
  try {
    placement.x = 42;
    assert.equal(book.pages('cat', false).find(page => page.id === '03').slots[1].x, 42);
  } finally {
    placement.x = original;
  }
  const width = placement.width;
  try {
    placement.width = -19;
    assert.equal(book.pages('cat', false).find(page => page.id === '03').slots[1].width, -19);
  } finally {
    placement.width = width;
  }
});

test('bin and ink marks have editable positions and text backing stays separate', () => {
  const pages = book.pages('dog', false);
  const waiting = pages.find(page => page.id === '03');
  assert.equal(waiting.foreground, 'assets/effects/bin.png');
  assert.deepEqual(Object.keys(context.PropLayout.bin), ['03']);
  assert.ok(context.PropLayout.bin['03'].width > 0);
  for (const id of ['11', '12']) {
    const page = pages.find(item => item.id === id);
    assert.equal(page.ink, 'assets/effects/ink.png');
    assert.equal(page.background, null);
    assert.ok(context.PropLayout.ink[id].width > 0);
  }
  assert.equal(pages.find(page => page.id === '01').storyWash, 'assets/textures/story-wash-v4.png');
  assert.equal(pages.find(page => page.id === 'cover').storyWash, null);
  assert.equal(pages.find(page => page.id === 'N'), undefined);
});

test('all pets produce 13 book pages and an optional note in seven sheets', () => {
  for (const pet of ['dog', 'cat', 'bird']) {
    const pages = book.pages(pet, true);
    assert.equal(pages.length, 14);
    assert.equal(book.sheets(pages).length, 7);
    assert.equal(pages.at(-1).id, 'N');
    const withoutNote = book.sheets(book.pages(pet, false));
    assert.equal(withoutNote.length, 7);
    assert.equal(withoutNote.at(-1)[1], null);
    assert.equal(pages[10].paragraphs.at(-1), '祂说，你想得到什么？');
    assert.equal(pages[11].paragraphs.length, 0);
    assert.equal(pages[12].paragraphs.length, 0);
    assert.ok(pages.every(p => !p.paragraphs.join('').includes('{宠物称呼}')));
  }
});

test('bird text and poses distinguish magical floating from natural flight', () => {
  const pages = book.pages('bird', true);
  assert.match(pages[4].paragraphs.join(''), /不用张开翅膀/);
  assert.match(pages[8].paragraphs.join(''), /小鸟得到了虚幻的羽冠，它勇敢地超越死亡/);
  assert.doesNotMatch(pages[8].paragraphs.join(''), /那不是让它飞得更高的翅膀/);
  assert.doesNotMatch(pages[4].paragraphs.join(''), /爪子踩在空气上/);
  assert.match(pages[6].paragraphs.join(''), /羽毛/);
  assert.equal(pages[4].slots[0].pose, 'float');
  assert.equal(pages[5].slots[0].pose, 'travel');
  assert.equal(pages[3].slots.length, 3);
  assert.equal(pages[7].slots[0].state, 'old');
});

test('all referenced layered assets exist and no sources are used', () => {
  for (const pet of ['dog', 'cat', 'bird']) {
    for (const page of book.pages(pet, true)) {
      for (const asset of book.assets(page, pet)) {
        assert.ok(!asset.includes('source/'));
        assert.ok(fs.existsSync(path.join(root, asset)), asset);
      }
    }
  }
});

test('all pets use character-sheet variants and integrated late-story effects', () => {
  const petDirectory = path.join(root, 'assets/pets');
  assert.deepEqual(fs.readdirSync(petDirectory).sort(), ['bird', 'cat', 'dog', 'poses']);
  assert.deepEqual(fs.readdirSync(path.join(petDirectory, 'poses')).sort(),
    ['bird', 'cat', 'dog'].flatMap(animal => [1, 2, 3].map(n => `${animal}-${String(n).padStart(2, '0')}.png`)).sort());
  for (const animal of ['dog', 'cat', 'bird']) {
    assert.equal(book.petAsset(animal, { state: 'healthy', pose: 'back' }),
      `assets/pets/${animal}/healthy-back.png`);
    assert.equal(book.petAsset(animal, { state: 'old', pose: 'back' }),
      `assets/pets/${animal}/old-back-${animal === 'dog' ? 'winged' : 'magic'}.png`);
    const story = book.pages(animal, false);
    assert.equal(book.petAsset(animal, story.find(page => page.id === '01').slots[0]),
      `assets/pets/${animal}/healthy-belly-up.png`);
    assert.equal(book.petAsset(animal, story.find(page => page.id === '02').slots[0]),
      `assets/pets/${animal}/healthy-curl.png`);
    const wait = book.pages(animal, false).find(page => page.id === '03');
    assert.deepEqual(Array.from(wait.slots, slot => slot.pose), ['reach', 'window-back', 'curl']);
    assert.deepEqual(Array.from(wait.slots, slot => book.petAsset(animal, slot)),
      ['reach', 'window-back', 'curl'].map(pose => `assets/pets/${animal}/healthy-${pose}.png`));
    assert.equal(book.petAsset(animal, story.find(page => page.id === '02').slots[0]),
      book.petAsset(animal, wait.slots[2]), '02 and the bin share exactly one curl sprite');
    assert.equal(wait.paragraphs[0], animal === 'bird'
      ? '小鸟站在门口，停在窗台上，站在被弄得一团糟的垃圾桶边沿。'
      : `${animal === 'dog' ? '小狗' : '小猫'}坐在门口，坐在窗台上，坐在被弄得一团糟的垃圾桶里。`);
    assert.equal(new Set(wait.slots.map(slot => book.petAsset(animal, slot))).size, 3);
    for (const page of book.pages(animal, false)) {
      for (const asset of book.assets(page, animal).filter(asset => asset.startsWith('assets/pets/'))) {
        assert.ok(asset.endsWith('.png'));
        assert.ok(fs.existsSync(path.join(root, asset)), asset);
      }
    }
    const used = new Set(story.flatMap(page => page.slots.map(slot => book.petAsset(animal, slot))));
    const directory = path.join(root, 'assets/pets', animal);
    assert.equal(used.size, 12);
    assert.deepEqual([...fs.readdirSync(directory)].sort(),
      [...used].map(asset => path.basename(asset)).sort());
    for (const id of ['08', '09', '10']) {
      const page = book.pages(animal, false).find(p => p.id === id);
      assert.equal(page.effect, null);
      assert.ok(!book.assets(page, animal).some(asset => asset.endsWith('/wings.svg') || asset.endsWith('/aura.svg')));
    }
  }
  const three = book.pages('dog', false).find(page => page.id === '03');
  assert.deepEqual(Array.from(three.slots, slot => slot.pose), ['reach', 'window-back', 'curl']);
  assert.equal(new Set(three.slots.map(slot => book.petAsset('dog', slot))).size, 3);
  for (const page of book.pages('dog', false)) {
    for (const asset of book.assets(page, 'dog').filter(asset => asset.startsWith('assets/pets/'))) {
      assert.ok(asset.endsWith('.png'));
      assert.ok(fs.existsSync(path.join(root, asset)), asset);
    }
  }
  const dogPages = book.pages('dog', false);
  assert.equal(dogPages.find(page => page.id === '06').slots[0].width, 16);
  for (const animal of ['dog', 'cat', 'bird']) {
    const pages = book.pages(animal, false);
    assert.equal(pages.find(page => page.id === '01').slots[0].x, 60);
    assert.equal(pages.find(page => page.id === '01').slots[0].y, animal === 'bird' ? 92 : 90);
    assert.equal(pages.find(page => page.id === '06').slots[0].width,
      animal === 'bird' ? 16 * .83 : 16);
    for (const [id, size] of [['07', animal === 'dog' || animal === 'bird' ? -18 : 18], ['08', 18]]) {
      assert.equal(pages.find(page => page.id === id).slots[0].width,
        animal === 'bird' ? size * .83 : size);
    }
  }
  assert.equal(book.petAsset('dog', three.slots[1]), 'assets/pets/dog/healthy-window-back.png');
  assert.equal(book.petAsset('dog', dogPages.find(page => page.id === '07').slots[0]), 'assets/pets/dog/old-look.png');
  for (const id of ['08', '09', '10']) {
    const page = dogPages.find(item => item.id === id);
    assert.equal(page.effect, null);
    assert.match(book.petAsset('dog', page.slots[0]), /-winged(?:-right)?\.png$/);
    assert.ok(!book.assets(page, 'dog').includes('assets/effects/wings.svg'));
  }
  assert.notEqual(book.petAsset('dog', dogPages.find(p => p.id === '09').slots[0]),
    book.petAsset('dog', dogPages.find(p => p.id === '10').slots[0]));
  for (const animal of ['cat', 'bird']) {
    const late = book.pages(animal, false);
    assert.equal(book.petAsset(animal, late.find(p => p.id === '08').slots[0]), `assets/pets/${animal}/old-float-magic.png`);
    assert.notEqual(book.petAsset(animal, late.find(p => p.id === '09').slots[0]),
      book.petAsset(animal, late.find(p => p.id === '10').slots[0]));
  }
});

test('invalid pet is rejected; sheet packing does not mutate input', () => {
  assert.throws(() => book.pages('dragon', true));
  const input = [1, 2, 3];
  assert.equal(book.sheets(input).length, 2);
  assert.deepEqual(input, [1, 2, 3]);
});

test('book pages share the new ornament and configurable props except the optional note', () => {
  for (const pet of ['dog', 'cat', 'bird']) {
    const pages = book.pages(pet, true);
    for (const page of pages) {
      assert.equal(page.texture, undefined);
      assert.equal(Boolean(page.decoration), page.id !== 'N');
      if (page.id !== 'N') assert.equal(page.decoration, 'assets/textures/border-v3.png');
      assert.ok(!book.assets(page, pet).includes('assets/textures/paper-v1.png'));
    }
    const city = pages.find(page => page.id === '07');
    assert.equal(city.decoration, 'assets/textures/border-v3.png');
    assert.ok(book.assets(city, pet).includes(city.decoration));
    assert.equal(city.background, 'assets/illustrations/07.png');
    assert.equal(city.slots[0].x, 30);
    assert.equal(city.slots[0].y, 83);
    assert.equal(city.slots.length, 1);
    assert.equal(pages.filter(page => page.sample).length, 1);
    assert.equal(city.sample, true);
    assert.equal(pages.find(page => page.id === '06').background, 'assets/illustrations/06.png');
    for (const page of pages.filter(page => page.slots.length)) {
      assert.equal(page.background, `assets/illustrations/${page.id}.png`);
    }
  }
});
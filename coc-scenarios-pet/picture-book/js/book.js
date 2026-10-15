/* Pure page composition, shared by the browser and Node's built-in tests. */
(function () {
  const pets = { dog: '小狗', cat: '小猫', bird: '小鸟' };
  const poses = ['back', 'sit', 'sit', 'sit', 'float', 'travel', 'sit', 'look', 'float', 'back', 'back'];
  // Coordinates are percentages of the 600 × 400 illustration canvas.

  function pages(pet, includeNote) {
    if (!Object.hasOwn(pets, pet)) throw new Error('未知宠物：' + pet);
    const result = Object.entries(BookText.common).map(([id, entry]) => {
      const index = id === 'cover' ? 0 : Number(id);
      const source = pet === 'bird' && BookText.birds[id] ? BookText.birds[id] : entry;
      const state = index >= 7 ? 'old' : index === 6 ? 'dirty' : 'healthy';
      const layout = PetLayout[pet][id];
      if (!layout || layout.length !== (id === '03' ? 3 : 1)) throw new Error(`布局槽位错误：${pet} ${id}`);
      let slots = [{ ...layout[0], pose: id === '01' ? 'belly-up' : id === '02' ? 'curl' : poses[index], state }];
      if (id === '10') slots[0].variant = 'right';
      if (id === '03') {
        slots = layout.map((placement, i) => ({
          ...placement,
          pose: ['reach', 'window-back', 'curl'][i], state,
        }));
      }
      return {
        id, label: entry.label,
        paragraphs: source.paragraphs.map(p => p.replaceAll('{宠物称呼}', pets[pet])),
        background: `assets/illustrations/${id}.png`, slots,
        sample: id === '07',
        effect: index === 4 ? 'glow' : null,
        foreground: id === '03' ? 'assets/effects/bin.png' : null,
      };
    });
    // Integer-like keys (10) sort ahead of cover in JS objects; enforce narrative order.
    result.sort((a, b) => (a.id === 'cover' ? 0 : Number(a.id)) - (b.id === 'cover' ? 0 : Number(b.id)));
    for (const id of ['11', '12']) result.push({ id, label: '涂黑页', paragraphs: [], slots: [], background: null,
      ink: 'assets/effects/ink.png' });
    if (includeNote) result.push({ id: 'N', label: '字条', paragraphs: ['超越死亡之人即可迎来新生'], slots: [] });
    return result.map(page => ({ ...page,
      decoration: page.id === 'N' ? null : 'assets/textures/border-v3.png',
      storyWash: page.paragraphs.length && !['cover', 'N'].includes(page.id) ? 'assets/textures/story-wash-v4.png' : null }));
  }

  function petAsset(pet, slot) {
    const directory = `assets/pets/${pet}/`;
    if (pet === 'dog') {
      if (slot.state === 'old' && slot.pose === 'float') return directory + 'old-float-winged.png';
      if (slot.state === 'old' && slot.pose === 'back') {
        return directory + `old-back-winged${slot.variant === 'right' ? '-right' : ''}.png`;
      }
      return directory + `${slot.state}-${slot.pose}.png`;
    }
    if (slot.state === 'old' && slot.pose === 'float') return directory + 'old-float-magic.png';
    if (slot.state === 'old' && slot.pose === 'back') {
      return directory + `old-back-magic${slot.variant === 'right' ? '-right' : ''}.png`;
    }
    return directory + `${slot.state}-${slot.pose}.png`;
  }

  function assets(page, pet) {
    return [page.decoration, page.background, page.foreground, page.ink, page.storyWash,
      page.effect && `assets/effects/${page.effect}.svg`,
      ...page.slots.map(slot => petAsset(pet, slot))].filter(Boolean);
  }

  function sheets(items) {
    const result = [];
    for (let i = 0; i < items.length; i += 2) result.push([items[i], items[i + 1] ?? null]);
    return result;
  }

  globalThis.Book = { pets, pages, sheets, assets, petAsset };
})();
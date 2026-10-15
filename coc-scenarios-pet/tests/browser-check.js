// Playwright browser_run_code_unsafe 可直接以 filename 加载此函数。
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.emulateMedia({ media: null });
  await page.goto('http://127.0.0.1:8765/');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已就绪'));
  assert(await page.getByLabel('阅读方式').inputValue() === 'all', '默认应为双页预览');
  assert(await page.locator('#preview .sheet').count() === 7, '首次打开应直接显示七张双页');
  const results = [];
  for (const name of ['小狗', '小猫', '小鸟']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已就绪'));
    const layout = await page.evaluate(() => {
      const leaves = [...document.querySelectorAll('#preview .leaf')];
      return {
        sheets: document.querySelectorAll('#preview .sheet').length,
        ids: leaves.map(n => n.dataset.page),
        overflow: leaves.filter(n => {
          const story = n.querySelector('.story');
          const folio = n.querySelector('.folio');
          return n.scrollHeight > n.clientHeight || (story && folio && story.getBoundingClientRect().bottom > folio.getBoundingClientRect().top);
        }).map(n => n.dataset.page),
        missing: [...document.images].filter(i => !i.complete || !i.naturalWidth).length,
      };
    });
    assert(layout.sheets === 7 && layout.ids[0] === 'cover', '页数或顺序错误');
    assert(layout.overflow.length === 0 && layout.missing === 0, '溢出或缺图');
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    assert(pages === 7, `PDF 应为 7 页，实际 ${pages}`);
    results.push({ pet: name, pdfPages: pages, ...layout });
  }
  await page.getByLabel('附带线索字条').uncheck();
  assert(await page.locator('#preview [data-page="N"]').count() === 0, '字条未关闭');
  assert(await page.locator('#preview .sheet').count() === 7, '关闭字条改变了纸张数');
  await page.getByLabel('阅读方式').selectOption('single');
  await page.getByLabel('翻到').selectOption('03');
  assert(await page.locator('#preview .pet').count() === 3, '等待页槽位错误');
  await page.locator('#preview .pet').first().click();
  assert(await page.title() === '一只小狗的探险 · 绘本工作台', '画面点击未切换');
  assert(await page.locator('#preview .pet:focus').count() === 1, '焦点丢失');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已就绪'));
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args) => {
      const child = open(...args);
      if (child) child.print = () => { child.printCalled = true; };
      return child;
    };
  });
  const singlePopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: '打印当前页', exact: true }).click();
  const single = await singlePopup;
  await single.waitForFunction(() => window.printCalled === true);
  await single.evaluate(() => document.fonts.ready);
  assert(await single.locator('.sheet').count() === 1, '单页打印排版错误');
  const singlePdf = await single.pdf({ preferCSSPageSize: true });
  assert((singlePdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length === 1, '单页 PDF 错误');
  await single.close();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert(mobile, '移动端整页横向溢出');
  await page.setViewportSize({ width: 1280, height: 900 });
  return { results, noteToggle: true, petClick: true, focus: true, currentPdf: 1, mobile };
}
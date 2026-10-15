async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.goto('http://127.0.0.1:8765/');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已就绪'));
  const toolbar = page.locator('.reader-container');
  assert(await toolbar.count() === 1, '选页控件应紧邻绘本');
  const bar = await toolbar.boundingBox();
  const art = await page.locator('#preview').boundingBox();
  assert(art.y - (bar.y + bar.height) < 25, '选页控件与结果间距过大');
  await page.getByLabel('阅读方式').selectOption('all');
  await page.getByLabel('翻到').selectOption('08');
  assert(await page.locator('#preview [data-page="08"]').evaluate(n => {
    const rect = n.getBoundingClientRect();
    return rect.top >= 0 && rect.top < innerHeight;
  }), '整本模式选页应滚动到对应结果');
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args) => {
      const child = open(...args);
      if (child) child.print = () => { child.printCalled = true; };
      return child;
    };
  });
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '打印当前页', exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(() => window.printCalled === true);
  assert(await popup.locator('button, select, header, nav, .workbench-container').count() === 0, '打印文档含操作控件');
  assert(await popup.locator('.sheet').count() === 1, '当前页应为一张纸');
  assert(await popup.locator('[data-page="08"]').count() === 1, '打印页不正确');
  assert(!(await popup.locator('body').innerText()).includes('打印整本'), '打印混入操作文案');
  const pdf = await popup.pdf({ preferCSSPageSize: true });
  assert((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length === 1, '打印 PDF 页数错误');
  await popup.close();
  const fullPopupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '打印整本 · 7 张 A4', exact: true }).click();
  const full = await fullPopupPromise;
  await full.waitForFunction(() => window.printCalled === true);
  assert(await full.locator('button, select, header, nav').count() === 0, '整本输出含操作控件');
  const fullPdf = await full.pdf({ preferCSSPageSize: true });
  assert((fullPdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length === 7, '整本 PDF 页数错误');
  await full.close();
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('.reader-container').isHidden(), '原生打印显示了选页控件');
  assert(await page.locator('.workbench-container').isHidden(), '原生打印显示了操作区');
  await page.emulateMedia({ media: 'screen' });
  return { nearbyControls: true, pageScroll: true, isolatedPrint: true, currentPdfPages: 1, fullPdfPages: 7, nativePrintHidesControls: true };
}
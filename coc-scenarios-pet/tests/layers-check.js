// Run with Playwright browser_run_code_unsafe.
async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.emulateMedia({ media: 'screen' });
  await page.goto('http://127.0.0.1:8765/');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已就绪'));
  assert(await page.getByLabel('正文字体').inputValue() === 'longcang', '默认正文字体应为龙藏体');
  assert(await page.locator('#preview .page-decoration').count() === 13, '除字条外全部书页应有边饰');
  assert(await page.locator('[data-page="N"] .page-decoration').count() === 0, '字条不应有边饰');
  const measureWash = root => [...document.querySelectorAll(`${root} .leaf`)]
      .filter(leaf => leaf.querySelector('.story-wash'))
      .map(leaf => {
        const wash = leaf.querySelector('.story-wash');
        const rect = wash.getBoundingClientRect();
        const pageRect = leaf.getBoundingClientRect();
        return { id: leaf.dataset.page, parentIsLeaf: wash.parentElement === leaf,
          width: rect.width, height: rect.height, x: rect.left - pageRect.left, y: rect.top - pageRect.top };
      });
  const previewWash = await page.evaluate(measureWash, '#preview');
  assert(previewWash.length === 10, '预览正文页文字底色数量错误');
  for (const item of previewWash) {
    assert(item.parentIsLeaf, `${item.id} 文字底色未与边饰同级`);
    assert(item.width > 0 && item.height > 0, `${item.id} 文字底色尺寸为零`);
    for (const key of ['width', 'height', 'x', 'y']) {
      assert(Math.abs(item[key] - previewWash[0][key]) < .1, `${item.id} 文字底色 ${key} 未统一`);
    }
  }
  await page.getByLabel('阅读方式').selectOption('single');
  await page.getByLabel('翻到').selectOption('07');
  const city = page.locator('#preview [data-page="07"]');
  assert((await city.locator('.background').getAttribute('src')).endsWith('07.png'), '古城最新图未接入');
  assert(await city.locator('.story p').count() === 4, '正文应独立排版');
  assert(await city.locator('button.pet').count() === 1, '宠物应独立可切换');
  const geometry = await city.evaluate(node => {
    const paper = node.querySelector('.page-decoration').getBoundingClientRect();
    const leaf = node.getBoundingClientRect();
    const story = node.querySelector('.story').getBoundingClientRect();
    const folio = node.querySelector('.folio').getBoundingClientRect();
    const firstLine = node.querySelector('.story p').getBoundingClientRect();
    const illustration = node.querySelector('.illustration').getBoundingClientRect();
    const insetMm = (paper.left - leaf.left) / 96 * 25.4;
    const storyGapMm = (firstLine.top - illustration.bottom) / 96 * 25.4;
    const folioStyle = getComputedStyle(node.querySelector('.folio'));
    return { insetMm, storyGapMm, readable: story.bottom < folio.top,
      folioClear: folioStyle.backgroundColor === 'rgba(0, 0, 0, 0)' && folioStyle.webkitTextStrokeWidth === '4px' && folioStyle.textShadow !== 'none' && Number(folioStyle.zIndex) > -1,
      fontLoaded: document.fonts.check('15px "Long Cang"'),
      fontFamily: getComputedStyle(node.querySelector('.story')).fontFamily };
  });
  assert(Math.abs(geometry.insetMm - 5) < .1 && geometry.readable, '边饰内缩或正文布局错误');
  assert(geometry.storyGapMm >= 17.9 && geometry.folioClear, '长文与纹样距离不足或页码被遮挡');
  assert(geometry.fontLoaded && geometry.fontFamily.includes('Long Cang'), '默认龙藏体未加载');
  await page.getByLabel('正文字体').selectOption('noto');
  await page.evaluate(() => document.fonts.ready);
  assert(await city.locator('.story').evaluate(n => getComputedStyle(n).fontFamily.includes('Noto Serif SC')), '字体切换失败');
  await page.getByLabel('正文字体').selectOption('longcang');
  await city.locator('button.pet').click();
  assert((await city.locator('.pet img').getAttribute('src')).includes('cat-'), '更换宠物失败');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已就绪'));
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  assert(await page.locator('#print-root .page-decoration').count() === 13, '打印缺少边饰');
  const printWash = await page.evaluate(measureWash, '#print-root');
  assert(printWash.length === 10, '打印正文页文字底色数量错误');
  for (const item of printWash) {
    assert(item.parentIsLeaf && item.width > 0 && item.height > 0, `${item.id} 打印文字底色层级或尺寸错误`);
    for (const key of ['width', 'height', 'x', 'y']) {
      assert(Math.abs(item[key] - previewWash[0][key]) < .1, `${item.id} 打印文字底色 ${key} 未统一`);
    }
  }
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
  const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert(pdfPages === 7, '双页打印应为七张 A4');
  await page.emulateMedia({ media: 'screen' });
  return { ...geometry, interchangeablePet: true, pdfPages };
}
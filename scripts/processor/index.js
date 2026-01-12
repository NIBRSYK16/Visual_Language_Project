/**
 * 数据处理器主入口
 * 运行: node scripts/processor/index.js
 */

const { processAllData } = require('./data-processor');

console.log('=== 数据处理器 ===\n');
console.log('开始处理数据...\n');

try {
  processAllData();
  console.log('\n✓ 数据处理完成！');
  process.exit(0);
} catch (error) {
  console.error('\n✗ 处理失败:', error);
  process.exit(1);
}

const { DataTypes } = require('sequelize');
const { sequelize, PlanMember } = require('../models');

// sequelize.sync() 不會替既有的資料表加欄位，新增欄位在這裡補上（可重複執行）
async function ensureSchema() {
  const qi = sequelize.getQueryInterface();

  // plan_members.sort_order：每個人自己的計劃排列順序（側欄拖曳）
  const cols = await qi.describeTable('plan_members');
  if (!cols.sort_order) {
    await qi.addColumn('plan_members', 'sort_order', { type: DataTypes.DOUBLE, allowNull: true });
    // 以目前「最近」的順序當作初始順序，升級後畫面不會突然變動
    const rows = await PlanMember.findAll({ order: [['userId', 'ASC'], ['lastViewedAt', 'DESC']] });
    const nextOf = {};
    for (const m of rows) {
      nextOf[m.userId] = (nextOf[m.userId] || 0) + 1;
      await m.update({ sortOrder: nextOf[m.userId] }, { silent: true });
    }
    console.log(`已新增 plan_members.sort_order，初始化 ${rows.length} 筆`);
  }
}

module.exports = { ensureSchema };

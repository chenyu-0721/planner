const bcrypt = require('bcryptjs');

// 只建立預設管理員，其他使用者由管理員登入後在「使用者管理」建立
module.exports = {
  async up() {
    const { User } = require('../src/models');
    await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin1111', 10),
        displayName: '系統管理員',
        role: 'admin',
        color: '#0078d4',
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { username: 'admin' });
  },
};

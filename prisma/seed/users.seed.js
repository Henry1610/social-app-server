import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

// Mảng họ tiếng Việt phổ biến
const VIETNAMESE_LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ',
  'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Mai',
  'Tạ', 'Lương', 'Trương', 'Chu', 'Đào', 'Hà', 'Thái', 'Cao', 'Lâm'
];

// Mảng tên đệm và tên tiếng Việt
const VIETNAMESE_MIDDLE_NAMES = [
  'Văn', 'Thị', 'Đức', 'Minh', 'Thanh', 'Hữu', 'Công', 'Thành', 'Quang',
  'Đăng', 'Tuấn', 'Anh', 'Hồng', 'Thu', 'Lan', 'Hương', 'Linh', 'Phương'
];

const VIETNAMESE_FIRST_NAMES = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đức', 'Giang', 'Hải', 'Hùng', 'Khang',
  'Long', 'Minh', 'Nam', 'Phong', 'Quang', 'Sơn', 'Thành', 'Tuấn', 'Việt',
  'Anh', 'Bảo', 'Chi', 'Dung', 'Hạnh', 'Hoa', 'Lan', 'Linh', 'Mai',
  'Nga', 'Phương', 'Quỳnh', 'Thảo', 'Thu', 'Trang', 'Uyên', 'Vy', 'Yến'
];

// Hàm tạo tên tiếng Việt ngẫu nhiên
const generateVietnameseName = () => {
  const lastName = faker.helpers.arrayElement(VIETNAMESE_LAST_NAMES);
  const middleName = faker.helpers.arrayElement(VIETNAMESE_MIDDLE_NAMES);
  const firstName = faker.helpers.arrayElement(VIETNAMESE_FIRST_NAMES);
  return `${lastName} ${middleName} ${firstName}`;
};

export async function seedUsers(prisma, count = 30) {
  const users = [];

  for (let i = 0; i < count; i++) {
    const passwordHash = await bcrypt.hash("123456", 10);
    const fullName = generateVietnameseName();

    users.push({
      username: faker.internet.username().toLowerCase(),
      email: faker.internet.email().toLowerCase(),
      passwordHash,
      fullName: fullName,
      avatarUrl: faker.image.avatar(),
      role: "user",
      isOnline: faker.datatype.boolean(),
      lastSeen: faker.date.recent({ days: 7 }),
      provider: "email",
    });
  }

  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  return prisma.user.findMany();
}

export const seedStudents = [
  ['李奕贤', '方浩同', '张鸣庭', '吴桐'],
  ['谢雨辰', '张诗琪', '张可馨', '周雪舟'],
  ['王一菀', '段舒涵', '李峻逸', '田一含'],
  ['何谐', '刘俊麟', '褚圻塬', '刘亚臻'],
  ['吕晨曦', '马启瑜', '邓丹妮', '彭梓怡'],
  ['苏琬云', '吴梓萱', '王鸿霖', '唐译鑫'],
  ['吕林润', '栗格', '补思颖', '谢雨桐', '刘静榆'],
  ['廖心蕊', '陈玉婷', '姚雨汐', '方怡瑄', '谢佳羲'],
].flatMap((names, index) => names.map(name => ({ name, group: index + 1, score: 0, status: '待完成预习' }))).map((student, index) => ({ ...student, id: String(8001 + index).padStart(5, '0') }))

export function migrateStudents(students) {
  const oldNames = ['林小满', '周子航', '陈雨桐']
  return students.length === 3 && students.every((student, index) => student.id === String(8001 + index).padStart(5, '0') && student.name === oldNames[index]) ? seedStudents : students
}

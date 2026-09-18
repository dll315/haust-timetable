/* 数据来源：河南科技大学研究生管理系统 yjsxt.haust.edu.cn/py/page/student/grkcb.htm
   抓取时间：2026-09-18 */

window.SCHEDULE = {
  student: {
    name: "代龙龙",
    id: "260320030579",
    college: "车辆与交通工程学院",
    major: "动力工程",
  },

  semester: {
    academicYear: "2026-2027",
    term: "第一学期",
    // 第一周周一的日期。由「2026-09-18 为第 3 周」反推得出。
    week1Monday: "2026-08-31",
    totalWeeks: 20,
    scrapedAt: "2026-09-18",
  },

  /* 河南科技大学教务处《作息时间》：第一套 5月1日起执行，第二套 10月1日起执行
     https://jwc.haust.edu.cn/rddh/zxsj.htm */
  bellSets: [
    {
      key: "summer",
      label: "第一套作息（5月1日起执行）",
      from: [5, 1],
      to: [9, 30],
      periods: [
        ["08:00", "08:45"], ["08:55", "09:40"], ["10:00", "10:45"], ["10:55", "11:40"],
        ["14:30", "15:15"], ["15:20", "16:05"], ["16:25", "17:10"], ["17:20", "18:05"],
        ["18:10", "18:55"], ["19:30", "20:15"], ["20:20", "21:05"], ["21:10", "21:55"],
      ],
    },
    {
      key: "winter",
      label: "第二套作息（10月1日起执行）",
      from: [10, 1],
      to: [4, 30],
      periods: [
        ["08:00", "08:45"], ["08:55", "09:40"], ["10:00", "10:45"], ["10:55", "11:40"],
        ["14:00", "14:45"], ["14:50", "15:35"], ["15:55", "16:40"], ["16:50", "17:35"],
        ["17:40", "18:25"], ["19:00", "19:45"], ["19:50", "20:35"], ["20:40", "21:25"],
      ],
    },
  ],

  bands: [
    { label: "上午", from: 1, to: 4 },
    { label: "下午", from: 5, to: 9 },
    { label: "晚上", from: 10, to: 12 },
  ],

  courses: [
    {
      id: "c1",
      name: "高等工程热力学",
      en: "Advanced Engineering Thermodynamics",
      code: "M03B08006",
      nature: "专业基础课",
      college: "车辆与交通工程学院",
      credits: 2.0,
      totalHours: 32,
      weeklyHours: 3,
      teachWeeks: 11,
      assess: "课堂闭卷",
      language: "中文",
      professor: "徐斌（教授）",
      color: "#2563eb",
      intro:
        "高等工程热力学是在本科工程热力学的基础上，对热力学基础部分的内容适当加深，并重点放在动力工程及工程热物理学科中对热力学理论的共性要求上。增加了本科工程热力学未深入介绍的实际气体、㶲分析、化学热力学等内容，课程具有明显的工程应用观点，重视分析处理实际问题的科学方法。",
    },
    {
      id: "c2",
      name: "现代换热理论及应用",
      en: "Modern Theory of Heat Transfer and its Applications",
      code: "M03C08039",
      nature: "专业选修课",
      college: "车辆与交通工程学院",
      credits: 2.0,
      totalHours: 33,
      weeklyHours: 3,
      teachWeeks: 11,
      assess: "课程论文",
      language: "中文",
      professor: "贺滔（副教授）",
      color: "#0d9488",
      intro:
        "随着科学技术的飞速发展，强化传热技术研究的深度和广度日益扩大并向新的领域渗透。本课程提炼了现代传热理论及其应用的新成果，以流场和温度场相互配合的换热强化场协同原理为基础，对高效换热技术的研究现状及其进展情况进行了分析和介绍。",
    },
    {
      id: "c3",
      name: "工程伦理",
      en: "Engineering Ethics",
      code: "M01A00007",
      nature: "公共必修课",
      college: "机电工程学院",
      credits: 1.0,
      totalHours: 16,
      weeklyHours: 2,
      teachWeeks: 8,
      assess: "课堂开卷",
      language: "中文",
      professor: "王斌（教授）",
      color: "#d97706",
      intro:
        "开展工程伦理教育有利于提升工程师伦理素养，加强工程从业者的社会责任。本课程“通论”部分主要探讨工程伦理的基本概念、基本理论以及工程实践过程中人们面对的共性问题；“分论”部分有针对性地分析不同工程领域遇到的特殊问题。",
    },
    {
      id: "c4",
      name: "数值计算方法与应用",
      en: "Numerical Simulation Methods and Applications",
      code: "M03C08068",
      nature: "专业选修课",
      college: "车辆与交通工程学院",
      credits: 2.0,
      totalHours: 32,
      weeklyHours: 0,
      teachWeeks: 0,
      assess: "其他",
      language: "中文",
      professor: "商伟伟（讲师）",
      color: "#7c3aed",
      intro:
        "数值计算是通过计算机计算和图像显示，在时间和空间上定量描述所研究的物理场。本课程在介绍计算流体力学的基础上，对多种数值计算方法，并重点对有限体积法的思想等进行介绍，同时对动力工程及工程热物理学科中常用的数值计算软件及其所涉及的领域进行介绍。",
    },
    {
      id: "c5",
      name: "硕士生英语",
      en: "English for Master's Students",
      code: "M15A00007",
      nature: "公共必修课",
      college: "外国语学院",
      credits: 2.0,
      totalHours: 32,
      weeklyHours: 2,
      teachWeeks: 16,
      assess: "课堂闭卷",
      language: "双语",
      professor: "高灵丽（副教授）",
      color: "#db2777",
      intro:
        "硕士生英语是非英语专业硕士生的必修课程。开课一学期，共 32 学时，由外国语学院大学外语系负责教学工作。该课程以英语阅读和写译为主要内容，使用双语教学，旨在提高学生借助工具阅读英文文献和学术著作、进行学术交流的能力。",
    },
    {
      id: "c6",
      name: "中国特色社会主义理论与实践研究",
      en: "Study on the Theory and Practice of Socialism with Chinese Characteristics",
      code: "M14A00002",
      nature: "公共必修课",
      college: "马克思主义学院",
      credits: 2.0,
      totalHours: 32,
      weeklyHours: 0,
      teachWeeks: 0,
      assess: "课程论文",
      language: "中文",
      professor: "纪中强（教授）",
      color: "#dc2626",
      intro:
        "本课程是硕士研究生的一门公共必修课程，具有鲜明的理论性、时代性、实践性。课程着重讲授中国共产党把马克思主义基本原理与中国实际相结合的历程，充分反映马克思主义中国化的理论成果，帮助学生系统掌握中国特色社会主义基本原理。",
    },
  ],

  /* day: 1=周一 … 7=周日；weeks 为原始周次表达式 */
  sessions: [
    { courseId: "c1", day: 1, start: 1, end: 2, weeks: "2-5,7-9,11", teacher: "徐斌", room: "西苑7-304" },
    { courseId: "c1", day: 5, start: 7, end: 8, weeks: "2-8,10", teacher: "徐斌", room: "西苑7-304" },
    { courseId: "c2", day: 2, start: 1, end: 2, weeks: "1-8", teacher: "贺滔", room: "车辆工程系会议室2-321" },
    { courseId: "c2", day: 4, start: 1, end: 2, weeks: "1-8", teacher: "贺滔", room: "车辆工程系会议室2-321" },
    { courseId: "c2", day: 2, start: 1, end: 1, weeks: "9", teacher: "贺滔", room: "车辆工程系会议室2-321" },
    { courseId: "c3", day: 1, start: 5, end: 6, weeks: "3-5,7", teacher: "张志文", room: "南十报告厅" },
    { courseId: "c3", day: 3, start: 5, end: 6, weeks: "3-5,7", teacher: "张志文", room: "南十报告厅" },
    { courseId: "c4", day: 5, start: 5, end: 6, weeks: "2-9", teacher: "商伟伟", room: "7号楼301" },
    { courseId: "c4", day: 2, start: 7, end: 8, weeks: "2-9", teacher: "商伟伟", room: "7号楼301" },
    { courseId: "c5", day: 3, start: 7, end: 8, weeks: "3-5,7-19", teacher: "吕煜", room: "西苑7-401" },
    { courseId: "c6", day: 3, start: 10, end: 11, weeks: "12-19", teacher: "马德成", room: "西苑7-420" },
    { courseId: "c6", day: 5, start: 10, end: 11, weeks: "12-19", teacher: "马德成", room: "西苑7-420" },
  ],
};

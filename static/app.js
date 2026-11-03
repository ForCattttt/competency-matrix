'use strict';
(() => {
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
// Keep the exam usable when private browsing or storage restrictions reject local storage.
const browserStore={getItem(key){try{return localStorage.getItem(key);}catch{return null;}},setItem(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}},removeItem(key){try{localStorage.removeItem(key);return true;}catch{return false;}}};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dict = {
  "选择岗位和作业题库，上传 Word 或粘贴题目后核对并导入。": "Pilih jabatan dan bank soal pekerjaan, unggah Word atau tempel soal, lalu periksa dan impor.",
  "可上传、编辑并启用自己提交的题目，供本部门考试使用。": "Anda dapat mengunggah, mengedit, dan mengaktifkan soal sendiri untuk ujian departemen Anda.",
  "选择已有岗位，添加具体作业项目；考试与实操项目可上传题目。": "Pilih jabatan yang tersedia dan tambahkan pekerjaan. Pekerjaan ujian serta praktik dapat menerima soal.",
  "本部门同一岗位共用题库；不同部门分别维护。": "Jabatan yang sama dalam departemen ini memakai bank soal bersama. Departemen berbeda dikelola terpisah.",
  "请先上传并启用岗位题目，再开放本部门的考试轮次。": "Unggah dan aktifkan soal jabatan terlebih dahulu, lalu buka putaran ujian departemen Anda.",
  "配置岗位和作业项目，上传启用题目，开放考试并完成评分导出。": "Atur jabatan dan pekerjaan, unggah serta aktifkan soal, buka ujian, lalu nilai dan ekspor hasil.",
  "配置岗位": "Atur jabatan",
  "添加本部门适用的岗位。": "Tambahkan jabatan yang sesuai untuk departemen Anda.",
  "添加作业项目": "Tambah pekerjaan",
  "选择岗位，设置考试与实操或直接评分项目。": "Pilih jabatan dan atur pekerjaan untuk ujian serta praktik, atau penilaian langsung.",
  "上传并启用题目": "Unggah dan aktifkan soal",
  "上传 Word 或粘贴试题，核对草稿后启用自己的题目。": "Unggah Word atau tempel soal, periksa draf, lalu aktifkan soal Anda.",
  "开放本部门考试": "Buka ujian departemen",
  "选择本部门岗位并开放考试轮次。": "Pilih jabatan departemen Anda dan buka putaran ujian.",
  "理论出分后评实操，直接评分项目无需考试。": "Nilai praktik setelah hasil teori tersedia. Penilaian langsung tidak memerlukan ujian.",
  "导出能力矩阵": "Ekspor matriks kompetensi",
  "查看评分结果，导出本部门能力矩阵。": "Lihat hasil penilaian dan ekspor matriks kompetensi departemen Anda.",
  "一键导出本部门全部岗位的能力矩阵。": "Ekspor matriks kompetensi semua jabatan departemen Anda.",
  "请先选择编号车间。": "Pilih area bernomor terlebih dahulu.",
  "只能管理本部门的考试轮次。": "Anda hanya dapat mengelola putaran ujian departemen Anda.",
  "添加本部门岗位，再配置岗位下的作业项目。": "Tambahkan jabatan departemen Anda, lalu atur pekerjaannya.",
  "可上传、编辑并启用自己提交的题目；其他人提交的题目只读。": "Anda dapat mengunggah, mengedit, dan mengaktifkan soal sendiri. Soal orang lain hanya dapat dilihat.",
  "按岗位配置、题库、考试和评分流程完成本部门能力评定。": "Selesaikan penilaian kompetensi departemen melalui jabatan, bank soal, ujian, dan penilaian.",
  "所属二线部门": "Departemen pendukung",
  "二线部门的岗位和题库仅供所选部门使用。": "Jabatan dan bank soal departemen pendukung hanya tersedia untuk departemen yang dipilih.",
  "该岗位仅供所选车间使用。": "Jabatan ini hanya tersedia untuk area yang dipilih.",
  "请选择本部门。": "Pilih departemen Anda.",
  "保存为草稿后，可编辑并启用自己提交的题目。": "Setelah disimpan sebagai draf, Anda dapat mengedit dan mengaktifkan soal sendiri.",
  "权限或配置已变化，请重新打开后保存。": "Izin atau konfigurasi berubah. Buka kembali sebelum menyimpan.",
  "还没有岗位，请先添加本部门的岗位。": "Belum ada jabatan. Tambahkan jabatan departemen Anda terlebih dahulu.",
  "添加岗位": "Tambah jabatan",
  "岗位已配置，请添加并启用考试与实操作业项目，再上传题目。": "Jabatan sudah tersedia. Tambahkan dan aktifkan pekerjaan ujian serta praktik sebelum mengunggah soal.",
  "作业项目还没有可用题库，请检查项目的启用状态、岗位和考核方式。": "Bank soal pekerjaan belum tersedia. Periksa status aktif, jabatan, dan metode penilaiannya.",
  "检查作业项目": "Periksa pekerjaan",
  "当前筛选下没有可导入的作业题库，请切换岗位或清空筛选。": "Tidak ada bank soal tujuan untuk filter ini. Ganti jabatan atau hapus filter.",
  "清空筛选": "Hapus filter",
  "岗位待确认": "Jabatan belum ditentukan",
  "同一大车间内，同一岗位共用题库；不同岗位分别维护。": "Dalam area utama yang sama, jabatan yang sama memakai bank soal bersama. Jabatan berbeda dikelola terpisah.",
  "同一大车间的同岗位共用题库；不同岗位分别维护，点检和数据技能仍按岗位评分。": "Jabatan yang sama dalam satu area utama memakai bank soal bersama. Jabatan berbeda terpisah; inspeksi dan keterampilan data tetap dinilai per jabatan.",
  "题库归属": "Cakupan bank soal",
  "作业题库": "Bank soal pekerjaan",
  "请先选择岗位和作业题库。": "Pilih jabatan dan bank soal pekerjaan terlebih dahulu.",
  "请选择岗位和作业题库": "Pilih jabatan dan bank soal pekerjaan",
  "显示密码": "Tampilkan kata sandi",
  "隐藏密码": "Sembunyikan kata sandi",
  "复制失败，请重试。": "Gagal menyalin. Coba lagi.",
  "内置类别": "Kategori bawaan",
  "新增作业类别": "Tambah kategori pekerjaan",
  "类别名称（中文）": "Nama kategori (Mandarin)",
  "类别名称（印尼文）": "Nama kategori (Indonesia)",
  "统计归属": "Kelompok statistik",
  "统计、导出按所选归属汇总；是否考试仍由考核方式决定。": "Statistik dan ekspor mengikuti kelompok terpilih. Metode penilaian tetap menentukan ujian.",
  "同一大车间的岗位可使用新增类别，已有项目和评分不变。": "Jabatan dalam area utama yang sama dapat memakai kategori baru. Tugas dan nilai lama tetap tersimpan.",
  "请填写作业类别名称": "Isi nama kategori pekerjaan.",
  "请选择有权限的大车间": "Pilih area utama yang dapat Anda kelola.",
  "作业类别已添加": "Kategori pekerjaan ditambahkan",
  "保存类别": "Simpan kategori",
  "作业类别与岗位必须属于同一大车间": "Kategori dan jabatan harus berada di area utama yang sama.",
  "原类别不可用，请重新选择": "Kategori sebelumnya tidak tersedia. Pilih kembali.",
  "作业类别保存结果无效，请刷新后核对": "Hasil kategori tidak valid. Segarkan untuk memeriksa.",
  "所属岗位已变化，请重新添加类别": "Jabatan berubah. Tambahkan kategori kembali.",
  "已配置的作业类别": "Kategori pekerjaan tersedia",
  "可添加作业项目和作业类别；自己创建的项目可编辑，其他项目只读。": "Anda dapat menambah pekerjaan dan kategori. Pekerjaan yang Anda buat dapat diedit; pekerjaan lainnya hanya dapat dilihat.",

  "正在确认登录状态…": "Memeriksa sesi masuk…",
  "登录状态确认失败，请重新登录。": "Sesi masuk tidak dapat dikonfirmasi. Silakan masuk kembali.",
  "能力培养": "Pengembangan Kompetensi",
  "删除考试记录": "Hapus catatan ujian",
  "仅系统管理员可删除未开始或已结束的考试记录，进行中的考试不能删除。": "Hanya administrator dapat menghapus ujian yang belum dimulai atau sudah berakhir. Ujian berlangsung tidak dapat dihapus.",
  "正在核对删除影响…": "Memeriksa dampak penghapusan…",
  "删除影响读取失败，请关闭后重新操作。": "Gagal membaca dampak penghapusan. Tutup dan coba lagi.",
  "我已核对姓名、工号及删除影响，确认删除这条考试记录。": "Saya telah memeriksa nama, nomor karyawan dan dampaknya, lalu mengonfirmasi penghapusan catatan ini.",
  "只移除本次考试和下列关联实操评分；员工档案、其他考试、直接评分及历史备份保留。": "Hanya ujian ini dan nilai praktik terkait di bawah yang dihapus dari data saat ini. Data karyawan, ujian lain, penilaian langsung dan arsip riwayat tetap disimpan.",
  "能力矩阵将按其他有效考试重新计算；没有其他有效考试时，本次理论及实操结果不再显示。": "Matriks dihitung ulang memakai ujian sah lainnya. Jika tidak ada, hasil teori dan praktik ujian ini tidak ditampilkan.",
  "待移除的关联实操评分": "Nilai praktik terkait yang akan dihapus",
  "考试或记录已变化，无法删除，请刷新列表。": "Ujian atau catatan berubah sehingga tidak dapat dihapus. Segarkan daftar.",
  "删除未开始考试记录": "Hapus catatan ujian yang belum dimulai",
  "仅系统管理员可删除尚未开始的考试记录。": "Hanya administrator sistem dapat menghapus catatan ujian yang belum dimulai.",
  "请核对姓名和完整工号。": "Periksa nama dan nomor karyawan lengkap.",
  "本次只删除所选考试记录，员工档案、其他成绩和直接评分保持不变。": "Hanya catatan ujian terpilih yang dihapus. Data karyawan, nilai lainnya, dan penilaian langsung tetap tersimpan.",
  "删除后无法在界面恢复；本轮参加记录仍保留，不会因此重新获得考试机会。": "Catatan tidak dapat dipulihkan melalui halaman ini. Riwayat keikutsertaan putaran tetap disimpan; penghapusan tidak membuka kesempatan ujian ulang.",
  "我已核对信息，确认删除这条未开始的考试记录。": "Saya telah memeriksa data dan mengonfirmasi penghapusan catatan ujian yang belum dimulai ini.",
  "请先勾选确认删除。": "Centang konfirmasi penghapusan terlebih dahulu.",
  "记录或登录状态已变化，请刷新后重新操作。": "Catatan atau sesi telah berubah. Segarkan halaman lalu ulangi.",
  "考试已开始或记录已变化，无法删除，请刷新列表。": "Ujian telah dimulai atau catatan berubah sehingga tidak dapat dihapus. Segarkan daftar.",
  "已删除，列表刷新失败，请刷新页面。": "Catatan telah dihapus, tetapi daftar gagal diperbarui. Segarkan halaman.",
  "共用题库": "Bank soal bersama",
  "全部共用题库": "Semua bank soal bersama",
  "全部主库题目": "Semua soal utama",
  "适用岗位": "Jabatan yang berlaku",
  "岗位配置": "Pengaturan jabatan",
  "已归并历史题": "Riwayat soal yang digabung",
  "已归并，历史只读": "Telah digabung, riwayat hanya baca",
  "共用题库中的题目只维护一次，各适用岗位使用同一题库。": "Soal dipelihara sekali dalam bank bersama dan digunakan oleh setiap jabatan yang berlaku.",
  "标准作业共用一个题库；岗位配置分别保留，点检和数据技能仍按岗位维护。": "Pekerjaan operasional memakai bank bersama; pengaturan jabatan tetap terpisah. Inspeksi dan data dikelola per jabatan.",
  "选择共用题库后，将用于下列已启用岗位；不会重复创建岗位题目。": "Setelah bank bersama dipilih, soal digunakan oleh jabatan aktif berikut tanpa membuat salinan per jabatan.",
  "请先选择共用题库。": "Pilih bank soal bersama terlebih dahulu.",
  "当前题库没有启用的适用岗位。": "Bank ini belum memiliki jabatan yang aktif.",
  "题库或岗位配置已更新，请重新打开后再保存。": "Bank soal atau pengaturan jabatan berubah. Buka ulang sebelum menyimpan.",
  "已有题目不能移动题库；请在原题库中维护。": "Soal yang ada tidak dapat dipindahkan ke bank lain; pelihara dalam bank asal.",
  "该岗位使用共用题库，此处仅调整启用状态、排序和实操要点。": "Jabatan ini memakai bank bersama. Di sini hanya status aktif, urutan, dan standar praktik yang diubah.",
  "导入仍使用真实作业项目 ID，系统自动归入对应共用题库；无需按岗位重复导入。": "Impor tetap memakai ID item kerja asli. Sistem memasukkannya ke bank bersama terkait tanpa impor berulang per jabatan.",
  "题目状态": "Status soal",
  "当前题目": "Soal saat ini",
  "草稿题目": "Draf soal",
  "已归档题目": "Soal yang diarsipkan",
  "全部题目": "Semua soal",
  "能力统计": "Statistik kompetensi",
  "刷新统计": "Segarkan statistik",
  "按已评定员工的技能项目，查看五档能力分布。": "Lihat distribusi lima tingkat kompetensi berdasarkan keterampilan karyawan yang sudah dinilai.",
  "刷新评分状态": "Segarkan status penilaian",
  "支持单人或多人分别评分；点检和数据技能无需考试。": "Nilai satu atau beberapa karyawan secara terpisah; keterampilan inspeksi dan data tidak memerlukan ujian.",
  "本账号可录入题目、查看本车间考试记录，并在能力矩阵和现场实操评分页为本车间多人分别评分。": "Akun ini dapat memasukkan soal, melihat hasil ujian area sendiri, serta menilai beberapa karyawan area sendiri secara terpisah melalui matriks kompetensi dan halaman praktik.",
  "可单人或多选员工分别评分，一键保存；也可按通用矩阵导出能力矩阵。": "Nilai satu atau beberapa karyawan secara terpisah dan simpan sekaligus; matriks juga dapat diekspor sesuai templat.",
  "可为本车间多人分别评分，一键保存；也可导出所选员工或全车间能力矩阵。": "Nilai beberapa karyawan area Anda secara terpisah dan simpan sekaligus; ekspor matriks karyawan terpilih atau seluruh area.",
  "成绩筛选": "Filter nilai",
  "全部成绩": "Semua nilai",
  "只看低于60分": "Hanya nilai di bawah 60",
  "低于60分": "Nilai di bawah 60",
  "先按姓名文字分组：汉字姓名在前，拉丁字母姓名在后；各组内再按岗位排列。": "Catatan dikelompokkan menurut aksara nama: Han lebih dahulu, lalu Latin. Di dalam setiap kelompok, catatan diurutkan menurut jabatan.",
  "项": "item",
  "直接评分": "Penilaian langsung",
  "无需考试": "Tanpa ujian",
  "待直接评分": "Menunggu penilaian langsung",
  "直接评分完成": "Penilaian langsung selesai",
  "直接评分等级": "Tingkat penilaian langsung",
  "直接评分时间": "Waktu penilaian langsung",
  "保存直接评分": "Simpan penilaian langsung",
  "保存评分": "Simpan nilai",
  "一键保存评分": "Simpan semua nilai",
  "五档评分": "Penilaian lima tingkat",
  "作业类别": "Kategori keterampilan",
  "考核方式": "Metode penilaian",
  "标准作业": "Pekerjaan operasional",
  "点检": "Inspeksi",
  "数据": "Data",
  "考试与实操": "Ujian dan praktik",
  "其他直接评分": "Penilaian langsung lainnya",
  "按通用矩阵五档直接评分，不需要题库或考试。": "Nilai langsung menurut lima tingkat matriks umum, tanpa bank soal atau ujian.",
  "点检、数据等技能直接评分；考试作业按理论与实操加权。": "Keterampilan inspeksi dan data dinilai langsung. Pekerjaan ujian menggunakan gabungan teori dan praktik.",
  "点检和数据技能无需考试，可直接进行五档评分。": "Keterampilan inspeksi dan data tidak memerlukan ujian dan dapat langsung dinilai dalam lima tingkat.",
  "原考试作业需要理论出分；点检和数据技能无需考试。": "Nilai teori diperlukan untuk pekerjaan ujian. Keterampilan inspeksi dan data tidak memerlukan ujian.",
  "直接评分不参与理论与实操加权，保存后直接生成月亮图。": "Penilaian langsung tidak digabung dengan teori dan praktik. Bulan kompetensi dibuat langsung setelah disimpan.",
  "直接评分独立保存，重考不会清空点检和数据评分。": "Nilai langsung disimpan terpisah; ujian ulang tidak menghapus nilai inspeksi dan data.",
  "直接评分项目不录入题目。": "Item penilaian langsung tidak menggunakan soal.",
  "该项目为直接评分，不接受题目。": "Item ini memakai penilaian langsung dan tidak menerima soal.",
  "查看评分历史": "Lihat riwayat penilaian",
  "评分历史": "Riwayat penilaian",
  "还没有评分历史": "Belum ada riwayat penilaian",
  "当前项目暂不可评分，请刷新页面确认。": "Item ini belum dapat dinilai. Muat ulang untuk memastikan.",
  "考试作业理论出分后可评实操；点检、数据技能可直接评分。": "Praktik untuk pekerjaan ujian dapat dinilai setelah teori keluar. Keterampilan inspeksi dan data dapat langsung dinilai.",
  "查看本岗位员工的答题、实操和直接评分结果。": "Lihat hasil ujian, praktik, dan penilaian langsung karyawan pada jabatan ini.",
  "仅考试作业使用人员类别权重；直接评分不参与加权。": "Bobot kategori karyawan hanya dipakai untuk pekerjaan ujian, bukan penilaian langsung.",
  "按考试与实操、点检、数据分类维护岗位技能。": "Kelola keterampilan jabatan menurut ujian dan praktik, inspeksi, serta data.",
  "评分人": "Penilai",
  "评分备注": "Catatan penilaian",
  "评分结果": "Hasil penilaian",
  "通用矩阵五档直接对应月亮图": "Lima tingkat matriks umum langsung menjadi bulan kompetensi",
  "考试作业需理论与实操；直接评分项目无需考试。": "Pekerjaan ujian memakai teori dan praktik; item penilaian langsung tidak memerlukan ujian.",
  "1 尚未掌握 → 5 可指导他人，直接对应通用矩阵月亮图。": "1 Sama sekali tidak bisa → 5 Bisa mengajari orang lain; langsung sesuai bulan pada matriks umum.",

  "员工完成开放轮次的考试后，记录会出现在这里。": "Catatan muncul setelah karyawan mengikuti putaran ujian yang dibuka.",
  "查看各轮考试记录、成绩和现场评分。": "Lihat catatan setiap putaran ujian, nilai, dan penilaian lapangan.",
  "单选、多选、判断题自动评分": "Pilihan tunggal, pilihan ganda, dan benar/salah dinilai otomatis",
  "考试记录或服务器评分已更新，请核对后重试。": "Catatan ujian atau nilai server telah berubah. Periksa lalu coba lagi.",
  "网络响应超时，请检查网络后重试。": "Koneksi melewati batas waktu. Periksa jaringan lalu coba lagi.",
  "作业项目超过50项，暂不能考试": "Lebih dari 50 item pekerjaan; ujian belum tersedia",

  "开放考试": "Buka ujian",
  "考试轮次": "Putaran ujian",
  "选择一个编号车间及岗位，独立开放本车间考试。": "Pilih satu unit area dan jabatan untuk membuka ujian unit tersebut.",
  "各编号车间独立管理考试轮次，开关和轮次编号互不影响。": "Setiap unit mengelola putaran sendiri. Status dan nomor putaran tidak memengaruhi unit lain.",
  "只调整本车间，其他车间不受影响。": "Hanya unit ini yang diubah. Unit lain tidak terpengaruh.",
  "请选择一个编号车间和至少一个岗位。": "Pilih satu unit area dan setidaknya satu jabatan.",
  "历史轮次（只读）": "Putaran sebelumnya (hanya lihat)",
  "新增考试轮次": "Buka putaran ujian",
  "编辑考试轮次": "Ubah putaran ujian",
  "当前开放轮次": "Putaran yang terbuka",
  "已开放": "Terbuka",
  "已关闭": "Ditutup",
  "开放下一轮": "Buka putaran berikutnya",
  "关闭考试": "Tutup ujian",
  "重新开放": "Buka kembali",
  "同一工号每轮只能完成一次考试；开放下一轮后可以再次考试。": "Setiap NIK hanya dapat menyelesaikan satu ujian per putaran. Ujian berikutnya tersedia setelah putaran baru dibuka.",
  "选择车间、岗位并开放考试，员工填写资料即可进入。": "Pilih area dan jabatan, lalu buka ujian. Karyawan dapat langsung masuk dengan mengisi data.",
  "开放下一轮后，本轮将关闭；已开始的考试可以继续完成。": "Putaran ini akan ditutup saat putaran berikutnya dibuka. Ujian yang sudah dimulai tetap dapat diselesaikan.",
  "请至少选择一个车间和岗位。": "Pilih setidaknya satu area dan satu jabatan.",
  "考试名称（中文）": "Nama ujian (Mandarin)",
  "考试名称（印尼文）": "Nama ujian (Indonesia)",
  "轮次编号": "Nomor putaran",
  "考试范围": "Cakupan ujian",
  "选择车间": "Pilih area",
  "选择岗位": "Pilih jabatan",
  "题库可用情况": "Kesiapan bank soal",
  "已有题目可考": "Soal tersedia",
  "暂无启用题目": "Belum ada soal aktif",
  "部分作业没有启用题目，暂不能考试": "Ada item pekerjaan tanpa soal aktif; ujian belum tersedia",
  "开放后，员工从统一考试入口直接填写资料进入，不需要分配考试。": "Setelah dibuka, karyawan mengisi data langsung di halaman ujian tanpa penugasan individual.",
  "没有考试轮次": "Belum ada putaran ujian",
  "先启用岗位题目，再开放本部门的考试轮次。": "Aktifkan soal jabatan terlebih dahulu, lalu buka putaran ujian departemen Anda.",
  "本轮每个工号限考一次": "Satu ujian per NIK pada putaran ini",
  "保存后只能查看，由管理员修改。": "Setelah disimpan, Anda hanya dapat melihat. Perubahan dilakukan administrator.",
  "实操参考表现": "Acuan kemampuan praktik",
  "综合能力等级": "Tingkat kompetensi gabungan",
  "实操参考表现用于现场选分；右侧等级按理论和实操加权计算。": "Acuan praktik membantu memilih nilai lapangan. Tingkat di sebelah kanan dihitung dari gabungan teori dan praktik.",
  "网络连接失败，请检查网络后重试。": "Koneksi gagal. Periksa jaringan lalu coba lagi.",
  "网络响应超时，评分和备注已保留；请重试确认保存结果。": "Koneksi melewati batas waktu. Nilai dan catatan tetap disimpan; coba lagi untuk memastikan hasil.",
  "JSON 文件不能超过 3 MiB。": "Berkas JSON tidak boleh melebihi 3 MiB.",
  "仅支持单选、多选和判断题；相同题目自动跳过。": "Hanya pilihan tunggal, pilihan ganda, dan benar/salah. Soal yang sama dilewati otomatis.",
  "单语题目启用后，另一语言将显示现有内容；请补全中印双语后用于正式考试。": "Jika soal satu bahasa diaktifkan, bahasa lain menampilkan teks yang tersedia. Lengkapi Mandarin dan Indonesia sebelum ujian resmi.",
  "已导入": "Diimpor",
  "重复跳过": "Duplikat dilewati",
  "单语题目": "Soal satu bahasa",
  "仅支持单选、多选、判断题。": "Hanya pilihan tunggal, pilihan ganda, dan benar/salah.",
  "选择范围后查看实际题数；每场最多50题，不足时使用全部启用题。": "Pilih cakupan untuk melihat jumlah soal. Maksimal 50 soal; jika lebih sedikit, semua soal aktif digunakan.",
  "请先选择大车间。": "Pilih kelompok area terlebih dahulu.",
  "关闭后尚未开始的员工不能进入，已开始答题的员工可继续交卷。": "Setelah ditutup, karyawan yang belum mulai tidak dapat masuk. Ujian yang sudah dimulai tetap dapat dikirim.",
  "本轮已关闭": "Putaran ini ditutup",
  "开放本轮": "Buka putaran ini",
  "考试已开放": "Ujian telah dibuka",
  "请选择考试范围": "Pilih cakupan ujian",
  "没有可选择的岗位": "Belum ada jabatan yang dapat dipilih",
  "没有可选择的车间": "Belum ada area yang dapat dipilih",

  "暂未开放": "Belum tersedia",
  "查看岗位开放情况": "Lihat ketersediaan ujian",
  "评分参考": "Panduan penilaian",
  "本作业考核要点": "Kriteria pekerjaan ini",
  "尚未填写，请结合现场作业标准评分。": "Belum diisi. Nilai berdasarkan standar pekerjaan di lapangan.",
  "请选择评分": "Pilih nilai",
  "已作废，需重新考试": "Dibatalkan; perlu ujian ulang",
  "提交异常待复核": "Pengiriman perlu ditinjau",
  "请联系系统管理员核对异常提交。": "Hubungi administrator untuk memeriksa pengiriman.",
  "核实后采纳迟到答案": "Terima jawaban terlambat setelah verifikasi",
  "作废本次异常考试": "Batalkan ujian ini",
  "复核说明": "Catatan peninjauan",
  "请填写复核依据，不能留空。": "Isi dasar peninjauan. Catatan wajib diisi.",
  "实操考核要点（中文）": "Kriteria praktik (Mandarin)",
  "实操考核要点（印尼文）": "Kriteria praktik (Indonesia)",
  "每场最多50题，不足时按实际题数考试；每题等分，折算100分。": "Maksimal 50 soal per ujian. Jika tersedia lebih sedikit, semua soal digunakan; bobot setiap soal sama dan nilai dikonversi ke skala 100.",
  "原题分值": "Poin soal sumber",
  "原题分值仅保留来源记录；新考试每题等分，折算100分。": "Poin soal sumber disimpan sebagai referensi; soal ujian baru berbobot sama dan nilai dikonversi ke skala 100.",

  "请填写工号、姓名，并选择自己的车间、岗位和人员类别。": "Isi NIK dan nama, lalu pilih area kerja, jabatan, dan kategori karyawan Anda.",
  "一键保存实操评分": "Simpan semua nilai praktik",
  "仅保存当前员工已选择的评分和备注。": "Hanya nilai dan catatan karyawan terpilih yang disimpan.",
  "没有待保存的评分": "Tidak ada nilai yang perlu disimpan",
  "保存失败，评分和备注已保留，请重试。": "Penyimpanan gagal. Nilai dan catatan tetap tersedia; coba lagi.",

  "车间工作台": "Ruang Kerja Area",
  "题库工作台": "Ruang Bank Soal",
  "录入题目，查看考试成绩，完成现场评分。": "Masukkan soal, lihat nilai ujian, dan nilai praktik lapangan.",
  "录入题目并查看考试记录。": "Masukkan soal dan lihat catatan ujian.",
  "近期考试": "Ujian terbaru",
  "全部记录": "Semua catatan",
  "安排考试后，可在这里查看最新记录。": "Catatan terbaru akan muncul setelah ujian dijadwalkan.",
  "日常工作": "Pekerjaan rutin",
  "维护题库": "Kelola bank soal",
  "按岗位和作业项目录入中印双语题目。": "Masukkan soal Mandarin–Indonesia sesuai jabatan dan item pekerjaan.",
  "查看本车间员工的成绩与考试状态。": "Lihat nilai dan status ujian karyawan area ini.",
  "现场评分与能力矩阵": "Penilaian praktik dan matriks kompetensi",
  "理论出分后，即可为各项作业评分。": "Setelah nilai teori tersedia, nilai setiap item pekerjaan.",
  "能力管理工作台": "Ruang Pengelolaan Kompetensi",
  "从岗位题库到现场评分，按流程完成员工能力评定。": "Selesaikan penilaian kompetensi dari bank soal jabatan hingga praktik lapangan.",
  "查看能力矩阵": "Lihat matriks kompetensi",
  "能力评定流程": "Alur penilaian kompetensi",
  "答题分数 + 现场评分 = 能力月亮图": "Nilai ujian + nilai praktik = matriks kompetensi bulan",
  "准备题库": "Siapkan bank soal",
  "按岗位和作业项目维护题目。": "Kelola soal sesuai jabatan dan item pekerjaan.",
  "安排考试": "Jadwalkan ujian",
  "随机抽取最多50题，不足时按实际题数考试。": "Pilih maksimal 50 soal secara acak; jika tersedia lebih sedikit, gunakan jumlah yang tersedia.",
  "现场评分": "Nilai praktik",
  "理论出分后，现场按 1–5 分评分。": "Setelah nilai teori tersedia, nilai praktik pada skala 1–5.",
  "自动生成月亮图，按通用矩阵导出。": "Hasilkan matriks bulan otomatis dan ekspor dengan matriks umum.",
  "车间导出": "Ekspor area",
  "一键导出车间全部岗位的能力矩阵。": "Ekspor matriks kompetensi seluruh jabatan di area.",
  "需要选择员工时，请进入能力矩阵页面。": "Untuk memilih karyawan, buka halaman matriks kompetensi.",
  "查看能力定级规则与通用导出。": "Lihat aturan tingkat kompetensi dan templat ekspor asli.",
  "员工能力结果按通用 Excel 导出导出。": "Hasil kompetensi diekspor dengan templat Excel asli.",
  "模板详细信息": "Detail templat",
  "考试与评分": "Ujian dan penilaian",

  "考试因切屏结束": "Ujian diakhiri karena berpindah layar",
  "终止时间": "Waktu penghentian",
  "已停止作答": "Pengerjaan dihentikan",
  "请选择员工": "Pilih karyawan",
  "答题分数": "Nilai ujian",
  "能力矩阵月亮图": "Matriks kompetensi bulan",
  "按人员类别加权计算": "Dihitung dengan bobot kategori karyawan",
  "选择员工后，在本页为每项作业评分并生成能力月亮。": "Pilih karyawan, nilai setiap item pekerjaan di halaman ini, lalu hasilkan tingkat kompetensi bulan.",
  "可导出本车间能力矩阵。选择岗位后，可勾选员工按通用矩阵导出；也可直接导出全车间。": "Anda dapat mengekspor matriks kompetensi area sendiri. Pilih jabatan untuk mencentang karyawan dan mengekspor dengan matriks umum, atau langsung ekspor seluruh area.",
  "选择员工后可评分；选择岗位后可勾选员工导出，也可直接导出全车间。": "Pilih karyawan untuk memberi nilai. Pilih jabatan untuk mengekspor karyawan terpilih, atau langsung ekspor seluruh area.",
  "理论出分即可进行实操评分，不设最低分限制": "Praktik dapat dinilai setelah nilai teori tersedia, tanpa batas nilai minimum",
  "按 1～5 分现场评分": "Nilai praktik lapangan 1–5",
  "自动生成综合分和月亮": "Nilai gabungan dan bulan dibuat otomatis",
  "先选择车间和岗位，再选择员工": "Pilih area dan jabatan, lalu karyawan",
  "查看本岗位员工的答题、实操和能力结果。": "Lihat nilai ujian, praktik, dan kompetensi karyawan pada jabatan ini.",
  "请先选择车间和岗位": "Pilih area dan jabatan terlebih dahulu",
  "请先选择员工": "Pilih karyawan terlebih dahulu",
  "能力结果": "Hasil kompetensi",
  "评分工作台": "Ruang penilaian",
  "车间能力月亮图": "Matriks kompetensi area",
  "月亮图仅展示已保存的评分结果。": "Matriks bulan hanya menampilkan penilaian yang telah disimpan.",
  "查看依据": "Lihat dasar penilaian",
  "评分备注": "Catatan penilaian",
  "已保存": "Tersimpan",
  "未保存": "Belum disimpan",
  "已保存，结果加载失败，请刷新页面。": "Nilai tersimpan, tetapi hasil belum dapat dimuat. Muat ulang halaman.",
  "员工已停用，不能进行现场实操评分。": "Karyawan dinonaktifkan dan tidak dapat dinilai praktiknya.",
  "当前项目暂不可评分，请刷新页面确认。": "Item ini belum dapat dinilai. Muat ulang halaman untuk memeriksa.",
  "尚未覆盖": "Belum tercakup",
  "实操满分 5 分，换算为百分制后按人员类别加权。": "Nilai penuh praktik adalah 5. Nilai dikonversi ke skala 100 lalu diberi bobot sesuai kategori.",
  "选择员工导出": "Pilih karyawan untuk ekspor",
  "导出全车间": "Ekspor seluruh area",
  "按原始模板导出所选员工": "Ekspor karyawan terpilih menggunakan matriks umum",
  "勾选需要导出的员工，可多选。": "Centang karyawan yang akan diekspor; dapat memilih lebih dari satu.",
  "全选": "Pilih semua",
  "清空": "Kosongkan",
  "已选择": "Terpilih",
  "人": "orang",
  "至少选择一名员工": "Pilih setidaknya satu karyawan",
  "导出所选员工": "Ekspor karyawan terpilih",
  "导出当前车间所有员工": "Ekspor semua karyawan pada area ini",
  "按车间和岗位筛选后可选择员工导出。": "Filter area dan jabatan untuk memilih karyawan yang akan diekspor.",
  "人员类别": "Kategori karyawan",
  "类别 B": "Kategori B",
  "待设置": "Belum ditetapkan",
  "待设置人员类别": "Kategori karyawan belum ditetapkan",
  "类别 A": "Kategori A",
  "类别 B": "Karyawan lapangan",
  "请选择人员类别": "Pilih kategori karyawan",
  "当前权重": "Bobot saat ini",
  "项目理论": "Teori item",
  "实操": "Praktik",
  "按人员类别计算": "Dihitung berdasarkan kategori karyawan",
  "示例类别均为理论 50% ＋ 实操 50%，可在评分配置中修改。": "Kategori demo: teori 50% + praktik 50%; dapat diubah melalui konfigurasi.",
  "综合分 = 项目理论分 × 理论权重 + 实操分 × 20 × 实操权重。": "Nilai gabungan = nilai teori item × bobot teori + nilai praktik × 20 × bobot praktik.",
  "请管理员在员工档案中设置人员类别，再进行现场实操评分。": "Minta administrator menetapkan kategori pada data karyawan sebelum menilai praktik lapangan.",
  "人员类别由管理员设置。": "Kategori karyawan ditetapkan administrator.",
  "人员类别由管理员按评估规则设置。": "Kategori ditetapkan administrator sesuai aturan penilaian.",
  "修改人员类别后，已保存实操按新权重重新计算；原评分和历史记录保留。": "Setelah kategori diubah, nilai praktik tersimpan dihitung ulang dengan bobot baru. Nilai asli dan riwayat tetap disimpan.",
  "评分时人员类别": "Kategori saat penilaian",
  "评分时权重": "Bobot saat penilaian",
  "当前类别与评分时不同，综合分已按当前类别重新计算。": "Kategori saat ini berbeda dari kategori saat penilaian. Nilai gabungan telah dihitung ulang menggunakan kategori saat ini.",
  "综合等级按员工档案中记录的人员类别及对应权重计算。": "Tingkat gabungan dihitung berdasarkan kategori yang tercatat dalam data karyawan beserta bobotnya.",
  "车间精益员": "Petugas Lean Area",
  "车间题库与实操": "Bank soal dan praktik area",
  "可录入题目，并为本编号车间符合条件的员工评分。": "Masukkan soal dan nilai praktik karyawan yang memenuhi syarat di area bernomor sendiri.",
  "现场实操安排": "Pengaturan praktik lapangan",
  "已达标": "Memenuhi syarat",
  "未达标": "Belum memenuhi syarat",
  "现场实操评分": "Penilaian praktik lapangan",
  "现场实操": "Praktik lapangan",
  "理论成绩": "Nilai teori",
  "理论总分": "Nilai teori keseluruhan",
  "项目理论分": "Nilai teori per item",
  "实操评分": "Nilai praktik",
  "综合分": "Nilai gabungan",
  "综合能力等级": "Tingkat kompetensi gabungan",
  "通用矩阵等级定义": "Definisi tingkat pada matriks umum",
  "理论出分即可进行实操评分，不设最低分限制。": "Praktik dapat dinilai setelah nilai teori tersedia, tanpa batas nilai minimum.",
  "每人每项作业按 1～5 分评分：1 分最低，5 分最高；实操百分制分数 = 所选分数 × 20。": "Nilai setiap item 1–5: 1 paling rendah, 5 paling tinggi. Nilai praktik skala 100 = nilai pilihan × 20.",
  "重考后，现场实操需要按新的考试重新评分。": "Setelah ujian ulang, praktik harus dinilai ulang berdasarkan ujian baru.",
  "选择车间和岗位后，再选择员工进行评分。": "Pilih area dan jabatan, lalu pilih karyawan yang akan dinilai.",
  "选择员工": "Pilih karyawan",
  "本岗位还没有员工": "Belum ada karyawan pada jabatan ini",
  "本岗位还没有作业项目": "Belum ada item pekerjaan untuk jabatan ini",
  "请联系系统管理员配置岗位、作业项目和员工。": "Hubungi administrator untuk menyiapkan jabatan, item pekerjaan, dan karyawan.",
  "请选择员工后查看理论成绩和各项目实操评分。": "Pilih karyawan untuk melihat nilai teori dan praktik tiap item.",
  "未考核": "Belum diuji",
  "理论待出分": "Menunggu nilai teori",
  "可进行实操评分": "Praktik dapat dinilai",
  "已记录切屏次数": "Jumlah perpindahan layar tercatat",
  "待实操评分": "Menunggu penilaian praktik",
  "综合评分完成": "Penilaian gabungan selesai",
  "尚未安排或完成理论考试，暂不能评分。": "Ujian teori belum ditugaskan atau selesai. Penilaian belum tersedia.",
  "理论考试尚未完成批改，请等待理论出分。": "Pemeriksaan ujian teori belum selesai. Tunggu nilai teori.",
  "本次理论考试未覆盖该项目，不能进行实操评分。": "Item ini tidak tercakup dalam ujian teori ini, sehingga praktik tidak dapat dinilai.",
  "当前账号只能查看，不能进行现场实操评分。": "Akun ini hanya dapat melihat dan tidak dapat menilai praktik.",
  "评分备注（选填）": "Catatan penilaian (opsional)",
  "保存实操评分": "Simpan nilai praktik",
  "实操评分已保存": "Nilai praktik disimpan",
  "评分人": "Penilai",
  "实操评分时间": "Waktu penilaian praktik",
  "1 分最低 / 5 分最高": "1 paling rendah / 5 paling tinggi",
  "请输入 1～5 的整数评分，不默认打分。": "Pilih nilai bilangan bulat 1–5. Tidak ada nilai bawaan.",
  "考试记录已更新，请刷新后重新选择本次考试评分。": "Catatan ujian telah berubah. Muat ulang dan pilih ujian saat ini.",
  "理论考试完成": "Ujian teori selesai",
  "理论待批改，出分后即可参加实操，不设最低分限制。": "Teori menunggu pemeriksaan. Setelah nilainya tersedia, praktik dapat dilakukan tanpa batas nilai minimum.",
  "仅显示理论考试成绩，现场实操另行评分。": "Hanya nilai ujian teori ditampilkan; praktik dinilai secara terpisah.",
  "按理论与实操综合生成": "Gabungan teori dan praktik",
  "按人员类别设置理论与实操权重；类别待设置或实操未评分时不生成月亮。": "Bobot teori dan praktik mengikuti kategori karyawan. Bulan belum dibuat jika kategori belum ditetapkan atau praktik belum dinilai.",
  "综合等级反映本次理论与现场实操评价结果。": "Tingkat gabungan mencerminkan hasil penilaian teori dan praktik ini.",
  "未安排或未覆盖的项目保持空白；理论未出分或实操未评时不生成等级。": "Item yang belum ditugaskan atau dicakup tetap kosong. Tingkat belum dibuat jika nilai teori belum tersedia atau praktik belum dinilai.",
  "本账号可录入题目、查看本车间考试记录，并在理论出分后进行现场实操评分。": "Akun ini dapat memasukkan soal, melihat hasil ujian area sendiri, dan menilai praktik setelah nilai teori tersedia.",
  "尝试次数过多，请一分钟后重试": "Terlalu banyak percobaan. Coba lagi setelah satu menit.",
  "进入考试操作较频繁，请稍后再试。": "Masuk ujian terlalu sering. Silakan coba lagi nanti.",
  "当前浏览器无法安全创建考试入口，请更新浏览器后重试。": "Browser ini tidak dapat membuat pendaftaran ujian dengan aman. Perbarui browser lalu coba lagi.",
  "考试资料或轮次已变更，请重新进入考试。": "Data pendaftaran berubah. Silakan masuk ujian lagi.",
  "车间名称（中文）": "Nama area (Mandarin)",
  "车间名称（印尼文）": "Nama area (Indonesia)",
  "岗位名称（中文）": "Nama jabatan (Mandarin)",
  "岗位名称（印尼文）": "Nama jabatan (Indonesia)",
  "使用考试码进入": "Masuk dengan kode ujian",
  "请填写姓名，并选择自己的车间、岗位和人员类别。": "Isi nama lengkap, lalu pilih area kerja, jabatan, dan kategori karyawan Anda.",
  "当前车间尚未配置岗位，请联系系统管理员。": "Jabatan untuk area ini belum disiapkan. Hubungi administrator.",
  "正在获取车间与岗位…": "Memuat area kerja dan jabatan…",
  "暂时无法获取车间与岗位，可使用考试码进入。": "Area dan jabatan belum dapat dimuat. Gunakan kode ujian.",
  "未找到匹配的员工考试，请核对姓名、车间和岗位，或联系管理员。": "Ujian karyawan tidak ditemukan. Periksa nama, area, dan jabatan, atau hubungi administrator.",
  "同车间同岗位有重名员工，请使用考试码进入。": "Ada nama yang sama pada area dan jabatan ini. Gunakan kode ujian.",
  "考试码无效或没有对应考试，请核对后重试。": "Kode tidak valid atau tidak memiliki ujian. Periksa dan coba lagi.",
  "进入考试": "Masuk ujian",
  "大车间": "Kategori area",
  "全部大车间": "Semua kategori area",
  "所属大车间": "Kategori area",
  "大车间类别": "Kategori area",
  "编号车间": "Area bernomor",
  "个编号车间": "area bernomor",
  "演示车间": "Area demonstrasi",
  "测试演示": "Demonstrasi",
  "测试演示岗位": "Jabatan demonstrasi",
  "编号车间用于人员与考试范围，岗位来自对应大车间的共用题库。": "Area bernomor menentukan cakupan karyawan dan ujian. Jabatan berasal dari bank soal bersama dalam kategori area yang sesuai.",
  "题库按大车间 → 岗位 → 作业项目 → 题目管理。编号车间分别管理员工与考试。": "Bank soal: kategori area → jabatan → item pekerjaan → soal. Karyawan dan ujian tetap dikelola per area bernomor.",
  "具体岗位由系统管理员后续配置，不预设岗位或作业项目。": "Jabatan dan item pekerjaan akan disiapkan administrator, tanpa jabatan bawaan.",
  "印尼文名称": "Nama bahasa Indonesia",
  "印尼文名称待维护": "Nama Indonesia belum tersedia",
  "该岗位用于演示考试流程。": "Jabatan ini digunakan untuk mendemonstrasikan alur ujian.",
  "原料": "Bahan baku",
  "请联系系统管理员配置岗位和作业项目，再录入题目。": "Hubungi administrator untuk menyiapkan jabatan dan item pekerjaan sebelum memasukkan soal.",
  "岗位与技能评估管理": "Pengelolaan kompetensi dan penilaian keterampilan",
  "题库编辑员": "Editor bank soal",
  "评价维度": "Dimensi penilaian",
  "全部维度": "Semua dimensi",
  "基础知识": "Pengetahuan dasar",
  "作业步骤": "Langkah operasi",
  "安全规范": "Aturan keselamatan",
  "质量标准": "Standar kualitas",
  "异常处置": "Penanganan gangguan",
  "待出分": "Menunggu nilai",
  "自动定级规则": "Aturan tingkat otomatis",
  "最多50题 / 场": "Maksimal 50 soal / ujian",
  "每场最多50题，不足时按实际题数考试；按作业项目和评价维度均衡抽题，每题等分，折算100分。": "Maksimal 50 soal per ujian; jika tersedia lebih sedikit, gunakan semua soal. Soal diseimbangkan per item dan dimensi, berbobot sama, dengan nilai pada skala 100.",
  "分数区间": "Rentang nilai",
  "月亮等级": "Tingkat bulan",
  "规则版本": "Versi aturan",
  "计分依据": "Dasar penilaian",
  "题数": "Jumlah soal",
  "维度覆盖": "Cakupan dimensi",
  "评分时间": "Waktu penilaian",
  "查看评分依据": "Lihat dasar nilai",
  "项目得分": "Nilai item",
  "题库与考试记录": "Bank soal dan hasil ujian",
  "新增、维护题目，并查看岗位考试记录。": "Tambahkan dan kelola soal, serta lihat hasil ujian jabatan.",
  "只能新增和导入题目；已提交题目由管理员维护。": "Anda hanya dapat menambah dan mengimpor soal; soal yang sudah dikirim dikelola administrator.",
  "本账号仅负责题库与考试记录；组织、组卷和权限由管理员维护。": "Akun ini menangani soal dan hasil ujian. Organisasi, penugasan ujian, dan akses dikelola administrator.",
  "我的题目": "Soal saya",
  "可见题目": "Soal terlihat",
  "查看考试记录": "Lihat hasil ujian",
  "题目可编辑，考试记录只读。": "Soal dapat diedit; hasil ujian hanya dapat dibaca.",
  "考试记录仅显示成绩与状态，不显示题目答案或员工考试码。": "Hasil menampilkan nilai dan status, tanpa jawaban atau kode ujian karyawan.",
  "当前没有可展示的逐题答卷。": "Tidak tersedia rincian jawaban per soal.",
  "客观题自动判分；简答题批改完成后出分并更新矩阵。": "Soal objektif dinilai otomatis; setelah esai diperiksa, nilai dan matriks diperbarui.",
  "题目按作业项目与评价维度分类，支持中文和印尼文。": "Soal dikelompokkan per item pekerjaan dan dimensi, dengan bahasa Mandarin dan Indonesia.",
  "员工考试入口": "Masuk ujian karyawan",
  "输入考试码或考试链接": "Masukkan kode atau tautan ujian",
  "考试码 / 考试链接": "Kode / tautan ujian",
  "无需后台账号。输入管理员提供的考试码，或粘贴完整考试链接。": "Tidak memerlukan akun admin. Masukkan kode dari administrator atau tempel tautan ujian lengkap.",
  "例如：ABCDE FGHJK": "Contoh: ABCDE FGHJK",
  "考试码": "Kode ujian",
  "复制考试码": "Salin kode ujian",
  "考试码已复制": "Kode ujian disalin",
  "统一考试入口": "Halaman masuk ujian",
  "返回员工考试入口": "Kembali ke halaman ujian",
  "管理人员登录": "Masuk administrator",
  "请向车间管理员领取本人的考试码或链接。": "Minta kode atau tautan ujian Anda kepada admin area.",
  "请填写有效考试码，或本系统的完整考试链接。": "Masukkan kode ujian yang valid atau tautan lengkap dari sistem ini.",
  "考试链接必须来自当前系统。": "Tautan ujian harus berasal dari sistem ini.",
  "无法打开这份考试，请检查考试码或向管理员确认。": "Ujian tidak dapat dibuka. Periksa kode atau hubungi administrator.",
  "考试入口地址": "Alamat halaman ujian",
  "将考试码和员工考试入口发给对应员工，也可以直接发送专属链接。": "Kirim kode dan halaman masuk kepada karyawan yang dituju, atau bagikan tautan khusus.",
  "员工不需要登录管理后台。": "Karyawan tidak perlu masuk ke pengelolaan.",
  "请只使用分配给本人的考试码或链接。": "Gunakan hanya kode atau tautan yang ditugaskan kepada Anda.",
  "登录后可管理组织、题库、考试和能力矩阵。": "Setelah masuk, kelola organisasi, bank soal, ujian, dan matriks kompetensi.",
  "按车间导出 Excel": "Ekspor Excel per area",
  "导出 Excel": "Ekspor Excel",
  "选择导出车间": "Pilih area ekspor",
  "车间能力矩阵": "Matriks kompetensi area",
  "选择车间，将该车间所有岗位的能力矩阵导出为一个 Excel 文件。": "Pilih area untuk mengekspor matriks semua jabatannya dalam satu berkas Excel.",
  "请先建立车间，再导出能力矩阵。": "Buat area dahulu sebelum mengekspor matriks.",
  "正在导出…": "Mengekspor…",
  "Excel 已导出": "Excel telah diekspor",
  "已开始下载，请在浏览器下载列表查看。": "Unduhan dimulai. Periksa daftar unduhan browser.",
  "登录已失效，请重新登录后再导出。": "Sesi berakhir. Masuk kembali sebelum mengekspor.",
  "导出失败，请重试。": "Ekspor gagal. Coba lagi.",
  "下载能力矩阵": "Unduh matriks kompetensi",
  "首页": "Beranda",
  "员工": "Karyawan",
  "公司与车间": "Perusahaan & area",
  "岗位": "Jabatan",
  "作业项目": "Item pekerjaan",
  "题库": "Bank soal",
  "考试": "Ujian",
  "考试记录": "Hasil ujian",
  "能力矩阵": "Matriks kompetensi",
  "评估": "Penilaian",
  "发展计划": "Pengembangan",
  "能力覆盖": "Cakupan kompetensi",
  "人才市场": "Pasar talenta",
  "统计分析": "Analitik",
  "用户权限": "Hak akses",
  "系统设置": "Pengaturan",
  "工作台": "RUANG KERJA",
  "组织与人员": "ORGANISASI",
  "能力与考试": "KOMPETENSI & UJIAN",
  "更多模块": "MODUL LAIN",
  "系统": "SISTEM",
  "本机演示版": "Kerangka lokal mandiri",
  "管理员": "Administrator",
  "车间管理员": "Admin area",
  "只读用户": "Pembaca",
  "退出": "Keluar",
  "新增": "Tambah",
  "编辑": "Edit",
  "删除": "Hapus",
  "取消": "Batal",
  "保存": "Simpan",
  "关闭": "Tutup",
  "确定删除": "Hapus sekarang",
  "搜索名称、编号或题目": "Cari nama, nomor, atau soal",
  "全部岗位": "Semua jabatan",
  "全部车间": "Semua area",
  "全部作业项目": "Semua item pekerjaan",
  "全部状态": "Semua status",
  "条记录": "catatan",
  "操作": "Tindakan",
  "名称": "Nama",
  "编号": "Kode",
  "说明": "Keterangan",
  "所属车间": "Area",
  "所属岗位": "Jabatan",
  "所属作业项目": "Item pekerjaan",
  "负责人": "Penanggung jawab",
  "启用": "Aktif",
  "停用": "Nonaktif",
  "状态": "Status",
  "草稿": "Draf",
  "已启用": "Aktif",
  "已归档": "Diarsipkan",
  "待考试": "Ditugaskan",
  "考试中": "Sedang ujian",
  "待批改": "Perlu diperiksa",
  "已完成": "Selesai",
  "题型": "Jenis soal",
  "单选题": "Pilihan tunggal",
  "多选题": "Pilihan ganda",
  "判断题": "Benar / salah",
  "简答题": "Esai",
  "分值": "Poin",
  "题目": "Soal",
  "中文题目": "Soal bahasa Mandarin",
  "印尼文题目": "Soal bahasa Indonesia",
  "中文": "Mandarin",
  "印尼文": "Indonesia",
  "人员": "Karyawan",
  "员工编号": "Nomor karyawan",
  "员工姓名": "Nama karyawan",
  "答题语言": "Bahasa ujian",
  "启用员工": "Karyawan aktif",
  "排序": "Urutan",
  "发布状态": "Status publikasi",
  "题目数量": "Jumlah soal",
  "实际题数": "Jumlah soal ujian",
  "题量上限": "Batas jumlah soal",
  "每题等分": "Bobot setiap soal sama",
  "每题等分，折算100分。": "Bobot setiap soal sama; nilai dikonversi ke skala 100.",
  "尚无可用题目": "Belum ada soal yang tersedia",
  "考试时长（分钟）": "Durasi (menit)",
  "及格线（百分制）": "Nilai lulus (0–100)",
  "考试名称": "Nama ujian",
  "考试计划": "Rencana ujian",
  "分配考试": "Tugaskan ujian",
  "选择考试计划": "Pilih rencana ujian",
  "查看": "Lihat",
  "考试链接": "Tautan ujian",
  "复制链接": "Salin tautan",
  "打开答题页": "Buka ujian",
  "导出 CSV": "Ekspor CSV",
  "导入题库": "Impor soal",
  "下载导入模板": "Unduh format impor",
  "暂无数据": "Belum ada data",
  "还没有车间": "Belum ada area",
  "还没有岗位": "Belum ada jabatan",
  "还没有作业项目": "Belum ada item pekerjaan",
  "还没有题目": "Belum ada soal",
  "还没有员工": "Belum ada karyawan",
  "还没有考试计划": "Belum ada rencana ujian",
  "还没有考试记录": "Belum ada hasil ujian",
  "先由车间维护作业项目和题目，再安排员工考试。": "Area menambahkan item pekerjaan dan soal, lalu menugaskan ujian kepada karyawan.",
  "这里不会自动生成真实作业项目、题目或员工。": "Sistem tidak membuat item pekerjaan, soal, atau karyawan nyata secara otomatis.",
  "请先新增车间，然后设置岗位。": "Tambahkan area dahulu, lalu buat jabatan.",
  "请先设置岗位，再由车间添加具体作业项目。": "Buat jabatan dahulu. Area kemudian menambahkan item pekerjaannya.",
  "请先添加作业项目，再录入该项目的题目与答案。": "Tambahkan item pekerjaan dahulu, lalu masukkan soal dan jawabannya.",
  "先录入员工并指定车间、岗位、人员类别和答题语言。": "Tambahkan karyawan beserta area, jabatan, kategori karyawan, dan bahasa ujian.",
  "每场最多50题，不足时按实际题数考试，可设置时长和及格线。": "Maksimal 50 soal per ujian; gunakan jumlah yang tersedia jika lebih sedikit. Durasi dan nilai lulus dapat diatur.",
  "创建考试计划并分配给员工后，记录会出现在这里。": "Hasil muncul setelah ujian ditugaskan kepada karyawan.",
  "登录": "Masuk",
  "登录管理后台": "Masuk ke pengelolaan",
  "用户名": "Nama pengguna",
  "密码": "Kata sandi",
  "使用本机管理员提供的账号登录。": "Masuk dengan akun yang diberikan administrator lokal.",
  "开源演示版": "Versi percobaan lokal",
  "车间维护项目与题库，系统负责组织考试、记录成绩和展示能力矩阵。": "Area mengelola pekerjaan dan bank soal. Sistem mengatur ujian, mencatat hasil, dan menampilkan matriks kompetensi.",
  "搭建你的能力管理工作台": "Siapkan ruang kerja kompetensi Anda",
  "从组织、作业项目和题库开始，逐步完成第一场岗位考试。": "Mulai dari organisasi, item pekerjaan, dan bank soal hingga ujian jabatan pertama.",
  "已配置车间": "Area tersedia",
  "启用题目": "Soal aktif",
  "员工总数": "Jumlah karyawan",
  "考试记录数": "Jumlah ujian",
  "按车间管理组织": "Dikelola per area",
  "仅统计可参与抽题的题目": "Hanya soal aktif untuk pengambilan acak",
  "已录入员工": "Karyawan yang telah didaftarkan",
  "包含待考试、待批改和已完成": "Termasuk ditugaskan, diperiksa, dan selesai",
  "搭建步骤": "Langkah penyiapan",
  "由你们车间定义内容": "Konten ditentukan oleh area",
  "建立车间与岗位": "Buat area dan jabatan",
  "先确定组织范围与考试岗位。": "Tentukan area organisasi dan jabatan ujian.",
  "维护作业项目": "Kelola item pekerjaan",
  "由车间自己填写项目名称和评价范围。": "Area menentukan nama item dan lingkup penilaian.",
  "录入岗位题库": "Masukkan bank soal jabatan",
  "支持双语题干、单选、多选、判断和简答。": "Mendukung dua bahasa, pilihan tunggal / ganda, benar / salah, dan esai.",
  "登记员工": "Daftarkan karyawan",
  "指定岗位和答题语言。": "Tentukan jabatan dan bahasa ujian.",
  "设置并分配考试": "Atur dan tugaskan ujian",
  "当前进度": "Status saat ini",
  "框架准备就绪": "Kerangka siap",
  "数据由车间维护": "Data dikelola area",
  "数据来源": "Sumber data",
  "真实本机数据库": "Basis data lokal nyata",
  "当前题库": "Bank soal saat ini",
  "由车间维护": "Dikelola area",
  "能力定级": "Penetapan tingkat",
  "模板": "Templat",
  "保留原文件": "Berkas asli disimpan",
  "框架模块": "Kerangka modul",
  "待接入": "Belum terhubung",
  "本页已保留导航和模块位置，业务功能尚未实现，不会产生虚构记录。": "Navigasi modul tersedia. Fungsi bisnis belum diterapkan dan tidak membuat catatan fiktif.",
  "返回首页": "Kembali ke beranda",
  "组织、岗位与员工": "Organisasi, jabatan, dan karyawan",
  "配置车间，作为岗位、员工和权限的管理范围。": "Atur area untuk mengelola jabatan, karyawan, dan hak akses.",
  "岗位对应题库、考试计划和员工。": "Jabatan terhubung dengan bank soal, rencana ujian, dan karyawan.",
  "各车间按岗位新增作业项目，再为项目维护题库。": "Nama dan isi item pekerjaan diisi area; dapat dibiarkan kosong dahulu.",
  "双语题库按作业项目管理；草稿题不会参与抽题。": "Soal dua bahasa dikelola per item; soal draf tidak diambil untuk ujian.",
  "员工通过专属考试链接答题，无需后台账号。": "Karyawan mengerjakan melalui tautan khusus tanpa akun pengelolaan.",
  "按岗位安排考试，客观题自动评分，简答题人工批改。": "Ujian per jabatan; soal objektif dinilai otomatis dan esai diperiksa manual.",
  "查看答题记录、完成简答题批改和复制考试链接。": "Lihat jawaban, periksa esai, dan salin tautan ujian.",
  "作业项目为行，员工为列。完成理论与实操评分后生成月亮，未评实操显示待实操。": "Item pekerjaan sebagai baris, karyawan sebagai kolom. Bulan ditampilkan setelah penilaian teori dan praktik selesai; praktik yang belum dinilai ditandai menunggu praktik.",
  "后台账号与车间范围；员工答题不需要在这里开户。": "Akun pengelolaan dan lingkup area; karyawan tidak perlu akun di sini.",
  "原始模板、数据规则和本机框架说明。": "Matriks umum, aturan data, dan informasi kerangka lokal.",
  "请选择": "Pilih",
  "新建": "Tambah",
  "请先准备所属数据": "Siapkan data induk dahulu",
  "保存后可在列表中查看和修改。": "Disimpan ke basis data lokal dan dapat diedit dari daftar.",
  "所有必填项均标有 *。": "Semua kolom wajib ditandai *.",
  "工号请在全公司范围内保持唯一。": "Nomor karyawan harus unik di perusahaan.",
  "答案只对有题库编辑权限的人员可见；员工答题不展示答案。": "Jawaban hanya terlihat oleh editor yang berwenang, bukan peserta ujian.",
  "选项": "Pilihan",
  "中文选项": "Pilihan Mandarin",
  "印尼文选项": "Pilihan Indonesia",
  "增加选项": "Tambah pilihan",
  "标准答案": "Jawaban benar",
  "中文参考答案": "Jawaban acuan Mandarin",
  "印尼文参考答案": "Jawaban acuan Indonesia",
  "正确": "Benar",
  "错误": "Salah",
  "至少填写两个选项。多选题需要选择全部正确选项。": "Isi minimal dua pilihan. Untuk pilihan ganda, tandai semua jawaban benar.",
  "简答题提交后需要管理员人工评分。": "Esai diperiksa manual oleh administrator setelah dikirim.",
  "可用题目": "Soal tersedia",
  "先保存考试计划，再给同岗位员工分配考试。": "Simpan rencana lalu tugaskan kepada karyawan dengan jabatan yang sama.",
  "打开考试": "Buka ujian",
  "工号": "Nomor",
  "得分": "Nilai",
  "考试状态": "Status ujian",
  "提交时间": "Waktu dikirim",
  "未提交": "Belum dikirim",
  "未开始": "Belum dimulai",
  "成绩": "Hasil",
  "待评": "Belum dinilai",
  "知识得分": "Nilai pengetahuan",
  "尚未掌握": "Belum mampu bekerja",
  "需全程指导": "Selesai dengan arahan",
  "需部分指导": "Selesai dengan pendampingan",
  "可独立完成": "Mampu mandiri",
  "可指导他人": "Mampu mengajar",
  "选择岗位后查看矩阵": "Pilih jabatan untuk melihat matriks",
  "先配置岗位、作业项目和员工，即可生成对应矩阵。": "Siapkan jabatan, item pekerjaan, dan karyawan untuk menampilkan matriks.",
  "下载的是当前数据 CSV；通用 Excel 导出可在系统设置原样下载。": "Ekspor ini adalah CSV data saat ini; templat Excel asli tersedia di Pengaturan.",
  "通用能力矩阵": "Templat matriks kompetensi asli",
  "下载原始 Excel": "Unduh Excel asli",
  "此文件按原样保留，未自动填入系统数据。": "Berkas disimpan asli tanpa pengisian otomatis dari sistem.",
  "模板元数据": "Metadata templat",
  "运行说明": "Informasi sistem",
  "当前版本": "Versi saat ini",
  "独立框架 / 本机版": "Kerangka mandiri / lokal",
  "持久存储": "Penyimpanan",
  "本机 SQLite 数据库": "Basis data SQLite lokal",
  "默认业务内容": "Konten bisnis bawaan",
  "空白，由车间录入": "Kosong; diisi area",
  "员工答题": "Ujian karyawan",
  "专属链接，无需后台账号": "Tautan khusus tanpa akun admin",
  "自动判分": "Penilaian otomatis",
  "客观题自动；简答题人工": "Objektif otomatis; esai manual",
  "当前可维护组织、题库、员工与岗位考试，并按成绩自动生成作业项目能力矩阵。": "Belum semua modul referensi terhubung. Organisasi, bank soal, karyawan, ujian, dan penilaian matriks sudah dapat disimpan.",
  "登录名": "Nama login",
  "显示名称": "Nama tampilan",
  "角色": "Peran",
  "重置密码（留空不变）": "Kata sandi baru (kosong: tetap)",
  "新账号密码": "Kata sandi akun baru",
  "车间管理员、题库编辑员和车间精益员必须指定所属车间。": "Admin area, editor soal, dan Petugas Lean Area harus memiliki area.",
  "删除记录": "Hapus catatan",
  "删除后无法在界面撤销；存在关联记录时，系统会阻止删除。": "Penghapusan tidak dapat dibatalkan dari antarmuka. Catatan dengan relasi akan dilindungi.",
  "确认删除这条记录？": "Hapus catatan ini?",
  "请选择 JSON 文件。导入会整批校验，任何一题有误都不会部分写入。": "Pilih berkas JSON. Impor divalidasi seluruhnya; jika ada kesalahan tidak ada soal yang disimpan sebagian.",
  "JSON 文件": "Berkas JSON",
  "文件结构为 {\"rows\": [...]}，work_item_id 使用当前系统里的作业项目 ID。": "Struktur: {\"rows\": [...]}. work_item_id harus menggunakan ID item dalam sistem.",
  "开始导入": "Mulai impor",
  "示意模板不包含真实生产题目。请填入你们自己的内容和正确答案。": "Format ini tidak berisi soal produksi nyata. Isi konten dan jawaban sendiri.",
  "员工答案": "Jawaban karyawan",
  "未作答": "Tidak dijawab",
  "人工得分": "Nilai manual",
  "保存批改": "Simpan pemeriksaan",
  "仅简答题需要人工给分；完成全部简答题评分后生成最终成绩。": "Hanya esai dinilai manual; hasil akhir tersedia setelah semua esai diperiksa.",
  "本次考试没有简答题需要批改。": "Ujian ini tidak memerlukan pemeriksaan esai.",
  "考试完成": "Ujian selesai",
  "考试已提交": "Ujian sudah dikirim",
  "您的答案已保存，简答题等待管理员批改。": "Jawaban tersimpan. Esai menunggu pemeriksaan administrator.",
  "您的成绩已记录。": "Hasil Anda telah dicatat.",
  "准备开始考试": "Siap memulai ujian",
  "开始后按规定时间作答，提交后不能修改。": "Setelah mulai, kerjakan sesuai waktu. Jawaban yang dikirim tidak dapat diubah.",
  "开始考试": "Mulai ujian",
  "提交试卷": "Kirim jawaban",
  "剩余时间": "Sisa waktu",
  "已作答": "Terjawab",
  "分钟": "menit",
  "题": "soal",
  "考生": "Peserta",
  "提交后不能更改答案，确认提交本次考试？": "Jawaban tidak dapat diubah setelah dikirim. Kirim ujian ini?",
  "确认提交": "Konfirmasi kirim",
  "继续答题": "Lanjutkan",
  "考试链接无效或暂时无法读取": "Tautan tidak valid atau tidak dapat dibaca",
  "重试": "Coba lagi",
  "查看考试前请先开始计时。": "Mulai penghitung waktu sebelum melihat soal.",
  "采用该语言题干；未录入翻译时显示已提供的另一种语言。": "Bahasa ini digunakan; jika terjemahan kosong akan ditampilkan bahasa yang tersedia.",
  "只读账号可以查看数据，不能新增、修改或分配考试。": "Akun pembaca dapat melihat data tanpa mengubah atau menugaskan ujian.",
  "请先完成本岗位题库，再分配考试。": "Lengkapi bank soal jabatan sebelum menugaskan ujian.",
  "本次作答会使用分配时冻结的题目和规则。": "Ujian memakai soal dan aturan yang dibekukan saat penugasan.",
  "请输入内容": "Masukkan isi",
  "暂无符合条件的数据": "Tidak ada data sesuai filter",
  "试着切换筛选条件或清空搜索。": "Ubah filter atau hapus pencarian.",
  "保存成功": "Berhasil disimpan",
  "删除成功": "Berhasil dihapus",
  "链接已复制": "Tautan disalin",
  "请求失败，请重试": "Permintaan gagal. Coba lagi.",
  "加载失败": "Gagal memuat",
  "正在保存…": "Menyimpan…",
  "正在提交…": "Mengirim…",
  "正在加载…": "Memuat…",
  "系统数据不会自动上传到外部服务。": "Data tidak diunggah otomatis ke layanan eksternal.",
  "导入成功": "Impor berhasil",
  "考卷已分配": "Ujian ditugaskan",
  "当前无可用试卷": "Belum ada rencana yang tersedia",
  "新建用户": "Tambah pengguna",
  "配置": "Atur",
  "最近考试": "Ujian terbaru",
  "先创建岗位考试计划，然后分配给同岗位员工。": "Buat rencana ujian dahulu, lalu tugaskan ke karyawan dengan jabatan yang sama.",
  "仅显示你有权限查看的车间数据。": "Akses data ditentukan oleh kewenangan server.",
  "退出登录": "Keluar akun",
  "这份考试已经结束，不能再次修改答案。": "Ujian telah berakhir; jawaban tidak dapat diubah lagi.",
  "链接拥有答题权限，请只发送给对应员工。": "Tautan memberikan akses ujian. Bagikan hanya ke karyawan yang dituju.",
  "该岗位还没有启用题目。": "Jabatan ini belum memiliki soal aktif.",
  "考试规则": "Aturan ujian"
};
let lang = browserStore.getItem('matrix-ui-lang') === 'id' ? 'id' : 'zh';
const BRAND = '岗位能力矩阵';
const t = s => s===BRAND?BRAND:(lang === 'id' ? (dict[s] || s) : s);
const iconPaths = {home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',building:'M4 21V3h12v18M16 9h4v12M1 21h22M8 7h4M8 11h4M8 15h4',briefcase:'M8 7V3h8v4M3 7h18v14H3zM3 12a28 28 0 0 0 18 0M10 13h4',list:'M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01',book:'M4 3h14a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3M3 17h17M7 7h9M7 11h7',clipboard:'M9 3H5v18h14V3h-4M9 2h6v4H9zM8 11h8M8 15h5',chart:'M4 3v18h18M8 16v-4M13 16V8M18 16V5',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',target:'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l9-9M16 3h5v5',trend:'M3 17 9 11l4 4 8-11M15 4h6v6',shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6',settings:'M9 3h6l1 4 4 1v6l-4 1-1 5H9l-1-5-4-1V8l4-1zM15 11.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plus:'M12 5v14M5 12h14',arrow:'M5 12h14M14 7l5 5-5 5',download:'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',check:'M5 12l4 4L19 6',menu:'M3 6h18M3 12h18M3 18h18',search:'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',logout:'M9 3H3v18h6M8 12h13M16 7l5 5-5 5',clock:'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',moon:'M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8'};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.grid}"/></svg>`;
const navGroups = [ ['工作台',[['dashboard','首页','home']]], ['组织与人员',[['employees','员工','users'],['company','公司与车间','building'],['positions','岗位','briefcase']]], ['能力与考试',[['work_items','作业项目','list'],['questions','题库','book'],['plans','开放考试','clipboard'],['results','考试记录','chart'],['matrix','能力矩阵','grid'],['practical','现场实操评分','target'],['statistics','能力统计','chart'],['development','能力培养','target']]], ['系统',[['users','用户权限','shield'],['settings','系统设置','settings']]] ];
const routeNames = Object.fromEntries(navGroups.flatMap(g => g[1]).map(a => [a[0],a[1]]));
function safeManagementPath(value) {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return '/dashboard';
  try {const url=new URL(value,location.origin);const key=url.pathname.slice(1);if(url.origin!==location.origin||!Object.prototype.hasOwnProperty.call(routeNames,key))return '/dashboard';return url.pathname+url.search;}catch{return '/dashboard';}
}
function publicLocation(){return ['/login','/exam'].includes(location.pathname)||location.pathname.startsWith('/take/');}
function clearManagementEditor(){const dialog=$('#editor');if(dialog?.open)dialog.close();const body=$('#editor-body');if(body)body.innerHTML='';editorSubmit=null;}
function goLogin(error='',next=location.pathname+location.search){
  invalidateManagementRequests(true);clearManagementEditor();resetMatrixSession();const target=safeManagementPath(next);route='login';filters={};matrix=null;clearInterval(timer);
  const path='/login?next='+encodeURIComponent(target);if(location.pathname!=='/login')history.replaceState({},'',path);
  renderLogin(error);
}
function entryLink(className='btn secondary'){return `<a class="${className}" href="/exam">${icon('clipboard')}${esc(t('员工考试入口'))}</a>`;}
function takeEntryLink(){return `<a class="take-return" href="/exam">${icon('arrow')}<span>${esc(t('返回员工考试入口'))}</span></a>`;}

const descriptions = {dashboard:'从组织、作业项目和题库开始，逐步完成第一场岗位考试。',company:'配置车间，作为岗位、员工和权限的管理范围。',positions:'题库按大车间 → 岗位 → 作业项目 → 题目管理。编号车间分别管理员工与考试。',work_items:'按考试与实操、点检、数据分类维护岗位技能。',questions:'题库按大车间 → 岗位 → 作业项目 → 题目管理。编号车间分别管理员工与考试。',employees:'先按姓名文字分组：汉字姓名在前，拉丁字母姓名在后；各组内再按岗位排列。',plans:'选择车间、岗位并开放考试，员工填写资料即可进入。',results:'先按姓名文字分组：汉字姓名在前，拉丁字母姓名在后；各组内再按岗位排列。',matrix:'点检、数据等技能直接评分；考试作业按理论与实操加权。',users:'后台账号与车间范围；员工答题不需要在这里开户。',settings:'原始模板、数据规则和本机框架说明。'};
const levels = ['尚未掌握','需全程指导','需部分指导','可独立完成','可指导他人'];
const types = {single:'单选题',multiple:'多选题',true_false:'判断题',essay:'简答题'};
const statuses = {draft:'草稿',active:'已启用',archived:'已归档',assigned:'待考试',in_progress:'考试中',pending_review:'待批改',completed:'已完成',voided:'已作废，需重新考试'};
const roles = {admin:'管理员',workshop_admin:'车间管理员',question_editor:'题库编辑员',question_contributor:'车间精益员',viewer:'只读用户'};
const dimensions = {knowledge:'基础知识',operation:'作业步骤',safety:'安全规范',quality:'质量标准',troubleshooting:'异常处置'};
function dimensionLabel(key){const entry=(data.rating_rules?.dimensions||[]).find(d=>d.key===key);return lang==='id'?(entry?.label_id||t(dimensions[key]||key)):(entry?.label_zh||dimensions[key]||key);}
let data = {}, route = location.pathname.split('/')[1] || 'dashboard', filters = {}, editorSubmit = null, matrix = null, exam = null, timer = null, practicalData = null;
let sessionChecked=false;
let managementEpoch=0,bootstrapSequence=0,bootstrapPending=null,renderedManagementRoute='',managementChromeKey='';
function invalidateManagementRequests(clearData=false){managementEpoch++;bootstrapSequence++;bootstrapPending=null;if(clearData)data={};}
let entryOptions=null,entryOptionsLoading=false,entryOptionsError='';
let entryIdentityDraft={},pendingRegistrationMemory=null,pendingRegistrationLoaded=false,registrationSubmitSerial=0;
const permitted = key => data.permissions?.[key]===true;
const restrictedQuestionRole = () => ['question_editor','question_contributor'].includes(data.user?.role);
const canAccessRoute = key => {
  if(key==='positions')return permitted('manage_positions')||permitted('manage_organization');
  if(key==='work_items')return permitted('manage_work_items')||permitted('manage_organization')||permitted('manage_work_categories');
  if(key==='statistics'||key==='development')return permitted('view_results');
  if(key==='matrix'&&data.user?.role==='question_contributor')return permitted('score_practical')&&Boolean(data.user?.workshop_id);
  if(key==='practical')return permitted('score_practical')||(!restrictedQuestionRole()&&permitted('view_results'));
  if(key==='plans')return permitted('manage_exam_rounds');
  if(restrictedQuestionRole())return ['dashboard','questions','results'].includes(key)&&(key!=='results'||permitted('view_results'));
  if(key==='users')return permitted('manage_users');
  return Object.prototype.hasOwnProperty.call(routeNames,key);
};
const canWrite = collection => {
  if(collection==='questions')return permitted('add_questions');
  if(collection==='positions')return permitted('manage_positions')||permitted('manage_organization');
  if(collection==='work_items')return permitted('manage_work_items')||permitted('manage_organization');
  if(collection==='users')return permitted('manage_users');
  if(['plans','assignments'].includes(collection))return false;
  if(collection==='workshops')return permitted('manage_organization')&&data.user?.role==='admin';
  return permitted('manage_organization');
};
const canEdit = (collection,row=null) => {
  if(data.user?.role==='question_contributor')return ['positions','work_items','questions'].includes(collection)&&Boolean(row&&row.created_by===data.user.id)&&(collection==='questions'?permitted('edit_own_questions')&&(!hasQuestionBankCatalog()||bankInUserScope(bankOfQuestion(row))):canWrite(collection)&&positionInUserScope(collection==='positions'?row:find('positions',row.position_id)));
  return collection==='questions'?permitted('edit_questions'):canWrite(collection);
};
const canDelete = collection => data.user?.role!=='question_contributor'&&(collection==='questions'?permitted('delete_questions'):canWrite(collection));
const canDeleteExamRecord = assignment => data.user?.role==='admin'&&permitted('manage_exams')&&['assigned','completed','pending_review','voided'].includes(assignment?.status)&&(assignment.status!=='assigned'||!assignment.started_at);

const list = name => Array.isArray(data[name]) ? data[name] : [];
const questionPrerequisiteMissing = () => questionImportItems().length===0;
const find = (collection,id) => list(collection).find(row => String(row.id) === String(id));
const nameOf = (collection,id) => find(collection,id)?.name || '—';
const positionOfQuestion = row => find('work_items',row.work_item_id)?.position_id;
// The shared catalog owns question content; work_items remain real per-position
// assessment bindings. Never send a bank ID to a work_items mutation endpoint.
const hasQuestionBankCatalog = () => Array.isArray(data.question_banks);
function bankOfQuestion(row){return find('question_banks',row?.question_bank_id||find('work_items',row?.work_item_id)?.question_bank_id);}
function bankMajorId(bank){return bank?.major_workshop_id||find('workshops',bank?.workshop_id)?.major_workshop_id||majorIdForPosition(find('positions',find('work_items',bank?.canonical_work_item_id)?.position_id));}
function bankMatchesMajor(bank,major){return !major||Boolean(bank)&&(major==='__legacy__'?!bankMajorId(bank):bankMajorId(bank)===major);}
function bankPositionId(bank){
  const explicit=typeof bank?.position_id==='string'?bank.position_id:'';
  if(explicit)return find('positions',explicit)?explicit:'';
  const ids=[...new Set((Array.isArray(bank?.position_ids)?bank.position_ids:[]).map(String).filter(Boolean))];
  return ids.length===1&&find('positions',ids[0])?ids[0]:'';
}
function questionPositionIds(row){
  const bank=bankOfQuestion(row);if(bank){const id=bankPositionId(bank);return id?[id]:[];}
  const id=row?.position_id||positionOfQuestion(row);return id&&find('positions',id)?[id]:[];
}
function questionItemIds(row){
  const bank=bankOfQuestion(row);if(bank){const position=bankPositionId(bank);if(!position)return [];const ids=Array.isArray(row?.applicable_work_item_ids)?row.applicable_work_item_ids:(bank.active_work_item_ids||bank.work_item_ids||[]);return [...new Set(ids.map(String))].filter(id=>{const item=find('work_items',id);return item?.position_id===position&&item.question_bank_id===bank.id;});}
  return row?.work_item_id?[String(row.work_item_id)]:[];
}
function questionPositionLabels(row){return questionPositionIds(row).map(id=>{const position=find('positions',id);return lang==='id'?(position?.name_id||position?.name||'—'):(position?.name||'—');}).join('、')||t('岗位待确认');}
function questionBankLabel(bank){
  const position=find('positions',bankPositionId(bank)),major=bankMajorId(bank),name=bank?.name||bank?.name_id||'—',nameId=bank?.name_id;
  return `${bank?.workshop_id?nameOf('workshops',bank.workshop_id):major?majorName(major):'—'} · ${position?(lang==='id'?(position.name_id||position.name):position.name):t('岗位待确认')} · ${name}${nameId&&nameId!==name?' / '+nameId:''}`;
}
function questionBankItem(bank,positionId=bankPositionId(bank)){
  const position=find('positions',positionId);
  if(!bank||!positionId||!position||bankPositionId(bank)!==positionId||bankMajorId(bank)!==majorIdForPosition(position)||(position.workshop_id&&!position.major_workshop_id&&bank.workshop_id!==position.workshop_id))return null;
  const items=list('work_items').filter(item=>item.question_bank_id===bank.id&&item.position_id===positionId&&item.active!==false&&!isDirectAssessment(item));
  return items.find(item=>item.id===bank.canonical_work_item_id)||items[0]||null;
}
function visibleQuestionBanks(scope=filters){return list('question_banks').filter(bank=>bank.assessment_mode!=='direct'&&bankInUserScope(bank)&&bankMatchesMajor(bank,scope.major_workshop_id)&&(!scope.position_id||bankPositionId(bank)===String(scope.position_id)));}
function questionMatchesPosition(row,positionId){return questionPositionIds(row).includes(String(positionId));}
function questionMatchesMajor(row,major){const bank=bankOfQuestion(row);return bank?bankMatchesMajor(bank,major):questionPositionIds(row).some(id=>positionMatchesMajor(find('positions',id),major));}
function questionBankOptions(selected='',major='',includeInactive=false,positionId=''){return option('',t('请选择'),selected)+(positionId?visibleQuestionBanks({major_workshop_id:major,position_id:positionId}):includeInactive?visibleQuestionBanks({major_workshop_id:major}).filter(bank=>bank.id===selected):[]).filter(bank=>(bankPositionId(bank)||includeInactive&&bank.id===selected)&&(includeInactive||bank.active!==false)).map(bank=>option(bank.id,questionBankLabel(bank),selected)).join('');}
function questionBankScopeNotice(bank){return `<p class="security-note">${esc(t(bank?.workshop_id?'本部门同一岗位共用题库；不同部门分别维护。':'同一大车间内，同一岗位共用题库；不同岗位分别维护。'))}</p><div class="readonly-value"><strong>${esc(t('题库归属'))}</strong>：${esc(bank?questionBankLabel(bank):t('请先选择岗位和作业题库。'))}</div>`;}

function majorIdForPosition(position){return position?.major_workshop_id||find('workshops',position?.workshop_id)?.major_workshop_id||'';}
function ownMajorId(){return find('workshops',data.user?.workshop_id)?.major_workshop_id||'';}
function isSupportMajor(id){return id==='major-demo-support'||find('major_workshops',id)?.code==='DEMO-SUP';}
function departmentSelfService(){return data.user?.role==='question_contributor'&&Boolean(data.user.workshop_id);}
function positionInUserScope(position){
  if(!position)return false;if(data.user?.role==='admin'||!data.user?.workshop_id)return true;
  const own=data.user.workshop_id,major=ownMajorId();
  if(isSupportMajor(major))return !position.major_workshop_id&&position.workshop_id===own;
  return position.major_workshop_id?position.major_workshop_id===major:position.workshop_id===own;
}
function bankInUserScope(bank){
  if(!bank)return false;if(data.user?.role==='admin'||!data.user?.workshop_id)return true;
  const own=data.user.workshop_id,major=ownMajorId();
  if(isSupportMajor(major))return !bank.major_workshop_id&&bank.workshop_id===own;
  return bank.major_workshop_id?bank.major_workshop_id===major:bank.workshop_id===own;
}
function visibleMajors(){const mine=ownMajorId();return data.user?.role==='admin'||!data.user?.workshop_id?list('major_workshops'):list('major_workshops').filter(m=>m.id===mine);}
function majorName(id){const major=find('major_workshops',id);return major?(lang==='id'?(major.name_id||t(major.name)):major.name):'—';}
function positionMajorLabel(position){return position?.major_workshop_id?majorName(position.major_workshop_id):nameOf('workshops',position?.workshop_id);}
function positionMatchesMajor(position,major){return !major||Boolean(position)&&(major==='__legacy__'?!majorIdForPosition(position):majorIdForPosition(position)===major);}
function positionMatchesWorkshop(position,workshopId,workshops=list('workshops')){if(!workshopId||!position)return false;if(position.major_workshop_id)return !isSupportMajor(position.major_workshop_id)&&workshops.find(w=>w.id===workshopId)?.major_workshop_id===position.major_workshop_id;return position.workshop_id===workshopId;}
function majorSelectOptions(selected='',blank='请选择',legacy=false){return option('',t(blank),selected)+visibleMajors().map(m=>option(m.id,majorName(m.id),selected)).join('')+(legacy&&list('positions').some(p=>!majorIdForPosition(p))?option('__legacy__',t('测试演示'),selected):'');}
function positionOptions(selected='',blank='请选择',predicate=()=>true){return option('',t(blank),selected)+list('positions').filter(p=>positionInUserScope(p)&&predicate(p)).map(p=>option(p.id,`${positionMajorLabel(p)} / ${p.name}${p.name_id?' / '+p.name_id:''}`,selected)).join('');}
function questionWorkItemFilterChoices(scope=filters){
  if(hasQuestionBankCatalog())return visibleQuestionBanks(scope).map(bank=>({value:String(bank.id),name:bank.name||bank.name_id||'',name_id:bank.name_id||'',item_ids:(bank.work_item_ids||[]).map(String),bank}));
  const groups=new Map();
  for(const item of list('work_items')){
    if(isDirectAssessment(item)||(scope.position_id&&item.position_id!==scope.position_id)||(scope.major_workshop_id&&!positionMatchesMajor(find('positions',item.position_id),scope.major_workshop_id)))continue;
    // Group matching names only within the same position. Different positions
    // keep distinct filter targets even when their work-item names are identical.
    const name=String(item.name||item.name_id||'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('id');
    const key=name?'__question_work_item_name__:'+encodeURIComponent(String(item.position_id||'')+'|'+name):String(item.id);
    if(!groups.has(key))groups.set(key,{value:key,name:item.name||item.name_id||'',name_id:item.name_id||'',position_id:item.position_id,item_ids:[]});
    const group=groups.get(key);group.item_ids.push(String(item.id));if(!group.name_id&&item.name_id)group.name_id=item.name_id;
  }
  return [...groups.values()];
}
function selectedQuestionWorkItemFilter(choices=questionWorkItemFilterChoices(),selected=hasQuestionBankCatalog()?filters.question_bank_id||filters.work_item_id:filters.work_item_id){return choices.find(choice=>choice.value===selected)||choices.find(choice=>choice.item_ids.includes(String(selected)));}
function questionWorkItemFilterOptions(){const choices=questionWorkItemFilterChoices(),selected=selectedQuestionWorkItemFilter(choices)?.value||'';return option('',t(hasQuestionBankCatalog()?'全部共用题库':'全部作业项目'),selected)+choices.map(choice=>{const position=find('positions',choice.position_id),label=choice.bank?questionBankLabel(choice.bank):`${positionMajorLabel(position)} · ${position?.name||t('岗位待确认')} · ${choice.name}${choice.name_id?' / '+choice.name_id:''}`;return option(choice.value,label,selected);}).join('');}
function questionStatusFilterValue(value=filters.question_status){return ['active','draft','archived','all',...(hasQuestionBankCatalog()?['merged']:[])].includes(value)?value:'current';}
function questionMatchesStatusFilter(row,value=filters.question_status){const selected=questionStatusFilterValue(value);if(hasQuestionBankCatalog()&&row?.merged_into_question_id)return selected==='merged';if(selected==='merged')return false;return selected==='all'||(selected==='current'?['active','draft'].includes(row?.status):row?.status===selected);}
function questionStatusFilterOptions(){return [['current','当前题目'],['active','启用题目'],['draft','草稿题目'],['archived','已归档题目'],['all',hasQuestionBankCatalog()?'全部主库题目':'全部题目'],...(hasQuestionBankCatalog()?[['merged','已归并历史题']]:[])].map(([value,label])=>option(value,t(label),questionStatusFilterValue())).join('');}

function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toast.timeout); toast.timeout=setTimeout(()=>el.classList.remove('visible'),4200); }
async function api(path,options={},guard=null) {
  const requestEpoch=guard?.epoch??managementEpoch;
  const opts={credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}};
  if(opts.body&&typeof opts.body!=='string')opts.body=JSON.stringify(opts.body);
  let res,requestTimer;const requestController=!opts.signal&&typeof AbortController==='function'?new AbortController():null;if(requestController)opts.signal=requestController.signal;try{res=await Promise.race([fetch(path,opts),new Promise((_,reject)=>{requestTimer=setTimeout(()=>{requestController?.abort();const error=new Error('网络响应超时，请检查网络后重试。 / Koneksi melewati batas waktu. Periksa jaringan lalu coba lagi.');error.requestTimeout=true;reject(error);},15000);})]);}catch(error){if(error.name==='AbortError'||error.requestTimeout)throw error;throw new Error('网络连接失败，请检查网络后重试。 / Koneksi gagal. Periksa jaringan lalu coba lagi.');}finally{clearTimeout(requestTimer);}const type=res.headers.get('content-type')||'';
  const body=type.includes('json')?await res.json():{error:await res.text()};
  if(!res.ok){const sessionExpired=res.status===401&&requestEpoch===managementEpoch&&(!guard||guard.sequence===bootstrapSequence)&&(typeof guard?.isCurrent!=='function'||guard.isCurrent())&&!publicLocation();if(sessionExpired)goLogin();const error=new Error(body.error||`${t('请求失败，请重试')} (${res.status})`);error.status=res.status;error.sessionExpired=sessionExpired;throw error;}
  return body;
}
function langSelect(){return `<select class="lang" data-action="language" aria-label="Language"><option value="zh" ${lang==='zh'?'selected':''}>中文</option><option value="id" ${lang==='id'?'selected':''}>Bahasa Indonesia</option></select>`;}
function badge(status){ const cls=['active','completed'].includes(status)?'green':status==='pending_review'?'orange':status==='archived'?'gray':'';return `<span class="badge ${cls}">${esc(t(statuses[status] || status))}</span>`; }
function moon(level){return level===null || level===undefined ? '<span class="moon-none" aria-hidden="true"></span>' : `<span class="moon level-${Number(level)}" aria-label="${esc(compositeLevelLabel(level))}"></span>`;}
function option(value,label,selected=''){return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;}
function selectOptions(collection,selected='',blank='请选择',predicate=()=>true){if(collection==='positions')return positionOptions(selected,blank,predicate);return option('',t(blank),selected)+list(collection).filter(predicate).map(r=>option(r.id,['workshops','work_items'].includes(collection)&&r.name_id?`${r.name} / ${r.name_id}`:r.name || r.title || r.username,selected)).join('');}
function pageHeading(title,description,actions=''){return `<div class="page-heading"><div><h1>${esc(t(title))}</h1>${description?`<p class="page-sub">${esc(t(description))}</p>`:''}</div>${actions?`<div class="actions">${actions}</div>`:''}</div>`;}
function btn(action,label,extra='',style='primary',ic='plus'){return `<button type="button" class="btn ${style}" data-action="${esc(action)}" ${extra}>${ic?icon(ic):''}${esc(t(label))}</button>`;}
function navigate(next){
  if(!data.user){goLogin();return;}
  if(!routeNames[next]||!canAccessRoute(next))next='dashboard';
  $('.sidebar')?.classList.remove('open');
  if(route===next&&location.pathname===`/${next}`)return;
  captureMatrixDrafts();invalidateResultsScoringProgress();invalidateAbilityStats();route=next;filters={};matrix=null;practicalData=null;practicalScope='';history.pushState({},'',`/${next}`);render();
  refresh({background:true}).catch(error=>{if(error.status!==401&&!publicLocation())toast(error.message);});
}
// A fresh document navigation can reach /login while same-origin API requests
// still carry a valid session. Revalidate on the server before showing the form.
async function restoreLoginSession(){
  if(location.pathname!=='/login')return false;
  invalidateManagementRequests(true);clearManagementEditor();clearInterval(timer);renderedManagementRoute='';managementChromeKey='';
  const epoch=managementEpoch,sequence=++bootstrapSequence,loginLocation=location.pathname+location.search;
  const current=()=>epoch===managementEpoch&&sequence===bootstrapSequence&&location.pathname==='/login'&&location.pathname+location.search===loginLocation;
  document.documentElement.lang=lang==='zh'?'zh-CN':'id';document.title=t('正在确认登录状态…')+' · '+BRAND;
  $('#app').innerHTML=`<div class="loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span>${esc(t('正在确认登录状态…'))}</div>`;
  try{
    const result=await api('/api/bootstrap',{}, {epoch,sequence,isCurrent:current});
    if(!current())return false;
    if(!result?.user?.id)throw new Error(t('登录状态确认失败，请重新登录。'));
    data=result;sessionChecked=true;
    const next=safeManagementPath(new URLSearchParams(location.search).get('next'));
    route=next.split('?')[0].slice(1);history.replaceState({},'',next);render();return true;
  }catch(error){
    if(!current())return false;
    sessionChecked=true;renderLogin(error.status===401?'':error.message);return false;
  }
}

function renderLogin(error='') {
  invalidateManagementRequests(true);renderedManagementRoute='';managementChromeKey='';
  clearManagementEditor();clearInterval(timer);document.documentElement.lang=lang==='zh'?'zh-CN':'id';document.title=t('登录管理后台')+' · '+BRAND;
  $('#app').innerHTML=`<div class="login-shell"><section class="login-art"><div class="take-brand"><img class="brand-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt="">${esc(BRAND)}</div><div><h1>${esc(t('岗位与技能评估管理'))}</h1><p>${esc(t('车间维护项目与题库，系统负责组织考试、记录成绩和展示能力矩阵。'))}</p><div class="login-moons">${levels.map((_,i)=>moon(i)).join('')}</div></div><small>${esc(t('开源演示版'))}</small></section><section class="login-form-wrap"><form id="login-form" class="login-form"><div style="text-align:right">${langSelect()}</div><h2>${esc(t('登录管理后台'))}</h2><p class="muted">${esc(t('登录后可管理组织、题库、考试和能力矩阵。'))}</p><label class="field"><span>${esc(t('用户名'))}</span><input name="username" autocomplete="username" required autofocus maxlength="100"></label><label class="field"><span>${esc(t('密码'))}</span><input type="password" name="password" autocomplete="current-password" required></label>${error?`<div class="form-error" role="alert">${esc(error)}</div>`:''}<button class="btn primary" type="submit">${esc(t('登录'))}${icon('arrow')}</button><div class="login-entry">${entryLink()}<p>${esc(t('员工不需要登录管理后台。'))}</p></div><p class="login-foot">${esc(t('本机演示版'))}<br>${esc(t('系统数据不会自动上传到外部服务。'))}</p></form></section></div>`;
}
function bilingualEntryName(row){return `${row.name||''} / ${row.name_id||'Nama Indonesia belum tersedia（印尼文名称待维护）'}`;}
const publicAssessmentNames={operator:{name:'类别 B',name_id:'Kategori B'},leader:{name:'类别 A',name_id:'Kategori A'}};
const identityEntryInvalid='考试入口无效，请核对工号、姓名、车间、岗位和人员类别，或联系管理员。 / Akses ujian tidak valid. Periksa nomor induk karyawan, nama, unit kerja, posisi, dan kategori personel, atau hubungi administrator.';
function entryAssessmentCategories(){const categories=entryOptions?.assessment_categories;return Array.isArray(categories)?categories.filter(category=>Object.hasOwn(publicAssessmentNames,category.key)):Object.entries(publicAssessmentNames).map(([key,names])=>({key,...names}));}
function positionAssessmentCategoryOverride(){return '';}
function positionAssessmentCategory(positionId,category,positions=entryOptions?.positions||[]){return positionAssessmentCategoryOverride(positionId,positions)||category||'';}
function forcedCategoryHelp(){return '类别由管理员按评估规则设置。<br>Kategori ditetapkan administrator.';}
function entryAssessmentCategoryOptions(positionId,selected){const override=positionAssessmentCategoryOverride(positionId);return override?option(override,bilingualEntryName(publicAssessmentNames[override]),override):option('','请选择人员类别 / Pilih kategori karyawan',selected)+entryAssessmentCategories().map(row=>option(row.key,bilingualEntryName(row),selected)).join('');}
function updateEntryAssessmentCategory(){const form=$('#employee-entry-form'),select=form?.elements.assessment_category;if(!select)return;const positionId=form.elements.position_id.value,selected=positionAssessmentCategory(positionId,select.value);select.innerHTML=entryAssessmentCategoryOptions(positionId,selected);select.value=selected;const help=$('#entry-category-help');if(help)help.innerHTML=positionAssessmentCategoryOverride(positionId)?forcedCategoryHelp():'请选择本人实际的人员类别。<br>Pilih kategori karyawan Anda yang sebenarnya.';}
function examAssessmentSummary(assignment){
  const names=publicAssessmentNames[assignment.assessment_category];
  const hasWeights=names&&typeof assignment.theory_weight==='number'&&typeof assignment.practical_weight==='number'&&assignment.theory_weight>=0&&assignment.practical_weight>=0&&Math.abs(assignment.theory_weight+assignment.practical_weight-1)<0.000001;
  return `<section class="exam-assessment-summary" aria-label="人员类别和评分权重 / Kategori dan bobot penilaian"><div><span>人员类别 / Kategori karyawan</span><strong>${esc(names?bilingualEntryName(names):'待设置 / Belum ditetapkan')}</strong></div><div><span>评分权重 / Bobot penilaian</span><strong>${hasWeights?`理论 / Teori ${esc(formatScore(assignment.theory_weight*100))}% ＋ 实操 / Praktik ${esc(formatScore(assignment.practical_weight*100))}%`:'待设置 / Belum ditetapkan'}</strong></div>${names&&hasWeights?'':'<p>请联系管理员在员工档案中设置人员类别。<br>Hubungi administrator untuk menetapkan kategori pada data karyawan.</p>'}</section>`;
}
function entryReadiness(workshopId,positionId){
  if(!Array.isArray(entryOptions?.readiness))return {ready:true};
  return entryOptions.readiness.find(row=>row.workshop_id===workshopId&&row.position_id===positionId)||{ready:false,reason_zh:'暂未开放',reason_id:'Belum tersedia'};
}
function entryExamQuestionCount(state){return Number(state.exam_question_count??Math.min(Number(state.required_question_count)||50,Number(state.available_question_count)||0));}
function entryPositionOptions(positions,selected,workshopId){
  return option('','请选择岗位 / Pilih jabatan',selected)+positions.map(position=>{
    const state=entryReadiness(workshopId,position.id),count=entryExamQuestionCount(state),suffix=state.ready?(count?` · ${count} ${t('题')}`:''):` · ${t('暂未开放')}`;
    const html=option(position.id,bilingualEntryName(position)+suffix,selected);return state.ready?html:html.replace('<option ','<option disabled ');
  }).join('');
}
function entryAvailabilityDetails(workshopId){
  if(!Array.isArray(entryOptions?.readiness)||!workshopId)return '';
  const rows=entryOptions.readiness.filter(row=>row.workshop_id===workshopId);
  return `<details class="entry-readiness-list"><summary>${esc(t('查看岗位开放情况'))}</summary><ul>${rows.map(row=>{const position=entryOptions.positions.find(position=>position.id===row.position_id);const reason=(row.reasons||[]).map(reason=>lang==='id'?reason.id:reason.zh).join('；')||(lang==='id'?row.reason_id:row.reason_zh);return `<li><strong>${esc(position?bilingualEntryName(position):'')}</strong><span class="${row.ready?'is-ready':''}">${esc(row.ready?entryRoundLabel(row)+` · ${entryExamQuestionCount(row)} ${t('题')}`:reason)}</span></li>`;}).join('')}</ul></details>`;
}
function updateEntryAvailability(){
  const form=$('#employee-entry-form');if(!form)return;
  updateEntryAssessmentCategory();
  const workshopId=form.elements.workshop_id.value,positionId=form.elements.position_id.value;
  const choices=(entryOptions?.positions||[]).filter(position=>positionMatchesWorkshop(position,workshopId,entryOptions?.workshops||[]));
  const state=positionId?entryReadiness(workshopId,positionId):null,anyReady=choices.some(position=>entryReadiness(workshopId,position.id).ready);
  const message=$('#entry-options-message');if(message){const text=state&&!state.ready?(lang==='id'?state.reason_id:state.reason_zh):!choices.length&&workshopId?t('当前车间尚未配置岗位，请联系系统管理员。'):workshopId&&!anyReady?t('暂未开放'):'';message.hidden=!text;message.className='notice warning';message.textContent=text;}
  const submit=$('button[type="submit"]',form);if(submit)submit.disabled=!choices.length||!anyReady||Boolean(state&&!state.ready);
  const details=$('#entry-availability');if(details)details.innerHTML=entryAvailabilityDetails(workshopId);
  const round=$('#entry-current-round');if(round)round.innerHTML=entryCurrentRound(workshopId,positionId);
}
function compositeLevelLabel(level){return t(levels[Number(level)]||'未考核');}
function isDirectAssessment(value){return value?.assessment_mode==='direct';}
// Display categories extend the three established calculation/export families.
const workCategoryBases=['operation','inspection','data'];
function categoryCatalog(){const raw=data.work_categories?.categories;if(Array.isArray(raw))return raw.filter(c=>c&&typeof c.id==='string'&&c.active!==false&&workCategoryBases.includes(c.base_category));return workCategoryBases.map(id=>({id,base_category:id,name:{operation:'标准作业',inspection:'点检',data:'数据'}[id],name_id:{operation:'Pekerjaan standar',inspection:'Inspeksi',data:'Data'}[id],builtin:true,active:true,major_workshop_id:''}));}
function canCreateWorkCategory(major=''){const allowed=data.work_categories?.allowed_major_workshop_ids||[];return ['admin','workshop_admin','question_contributor'].includes(data.user?.role)&&permitted('manage_work_categories')&&data.work_categories?.can_create===true&&allowed.some(id=>visibleMajors().some(m=>m.id===id))&&(!major||allowed.includes(major));}
function workCategorySummary(){const categories=categoryCatalog().filter(c=>c.builtin||!filters.major_workshop_id||c.major_workshop_id===filters.major_workshop_id);return `<details class="panel work-category-list"><summary>${esc(t('已配置的作业类别'))}（${categories.length}）</summary><ul>${categories.map(c=>`<li><strong>${esc(lang==='id'?(c.name_id||c.name):c.name)}</strong><span>${esc(c.builtin?t('内置类别'):majorName(c.major_workshop_id)+' · '+t('统计归属')+'：'+t({operation:'标准作业',inspection:'点检',data:'数据'}[c.base_category]))}</span></li>`).join('')}</ul></details>`;}
function workCategoryOptions(selected='operation',positionId=''){const major=majorIdForPosition(find('positions',positionId)),categories=categoryCatalog().filter(c=>c.builtin||c.major_workshop_id===major);let markup=categories.map(c=>option(c.id,c.name_id&&c.name_id!==c.name?`${c.name} / ${c.name_id}`:c.name,selected)).join('');if(selected&&!categories.some(c=>c.id===selected))markup=option(selected,t('原类别不可用，请重新选择'),selected)+markup;return markup;}
function workCategoryFields(item,positionId){const selected=item.work_category_id||item.skill_category||'operation';return `<div class="work-category-field">${selectField('work_category_id','作业类别',workCategoryOptions(selected,positionId),'required data-dependent="work-category"')}<input type="hidden" name="skill_category" value="${esc(item.skill_category||'operation')}">${canCreateWorkCategory()?btn('create-work-category','新增作业类别','data-inline="true"','link','plus'):''}</div>`;}
function readWorkCategoryBinding(form,payload){const selected=form.elements.work_category_id?.value||payload.work_category_id||payload.skill_category||'operation',category=categoryCatalog().find(c=>c.id===selected);if(!category)throw Error(t('原类别不可用，请重新选择'));const positionId=String(payload.position_id||form.elements.position_id?.value||''),major=majorIdForPosition(find('positions',positionId));if(!category.builtin&&(!major||category.major_workshop_id!==major))throw Error(t('作业类别与岗位必须属于同一大车间'));payload.skill_category=category.base_category;payload.work_category_id=category.builtin?'':category.id;return payload;}
function updateWorkCategoryChoices(){const form=$('#editor-form'),select=form?.elements.work_category_id;if(!select)return;const positionId=form.elements.position_id?.value||'',major=majorIdForPosition(find('positions',positionId)),previous=select.value,old=categoryCatalog().find(c=>c.id===previous),valid=old&&(old.builtin||old.major_workshop_id===major);select.innerHTML=workCategoryOptions(valid?previous:'operation',positionId);if(form.elements.skill_category)form.elements.skill_category.value=categoryCatalog().find(c=>c.id===select.value)?.base_category||'operation';const add=$('[data-action="create-work-category"][data-inline]',form);if(add)add.disabled=!canCreateWorkCategory(major)||!major;const panel=$('#inline-work-category',form);if(panel&&panel.dataset.major!==major){panel.remove();}}
function workCategoryCreateFields(major,base='operation',inline=false){const allowed=data.work_categories?.allowed_major_workshop_ids||[],majors=visibleMajors().filter(m=>allowed.includes(m.id));return `${inline?`<input type="hidden" name="category_major_workshop_id" value="${esc(major)}">`:selectField('category_major_workshop_id','所属大车间',option('',t('请选择'),major)+majors.map(m=>option(m.id,lang==='id'?(m.name_id||m.name):m.name,major)).join(''),'required')}${field('category_name','类别名称（中文）','','text',`${inline?'':'required'} maxlength="80"`)}${field('category_name_id','类别名称（印尼文）','','text','maxlength="120"')}${selectField('category_base_category','统计归属',workCategoryBases.map(k=>option(k,t({operation:'标准作业',inspection:'点检',data:'数据'}[k]),base)).join(''),inline?'':'required')}<p class="security-note">${esc(t('统计、导出按所选归属汇总；是否考试仍由考核方式决定。'))}</p>`;}
function workCategoryCreateBody(form){const body={name:form.elements.category_name?.value?.trim()||'',name_id:form.elements.category_name_id?.value?.trim()||'',base_category:form.elements.category_base_category?.value||'operation',major_workshop_id:form.elements.category_major_workshop_id?.value||''};if(!body.name)throw Error(t('请填写作业类别名称'));if(!canCreateWorkCategory(body.major_workshop_id)||!body.major_workshop_id)throw Error(t('请选择有权限的大车间'));return body;}
function rememberWorkCategory(category){if(!category||typeof category.id!=='string'||!workCategoryBases.includes(category.base_category))throw Error(t('作业类别保存结果无效，请刷新后核对'));const current=categoryCatalog();data.work_categories={...data.work_categories,categories:[...current.filter(c=>c.id!==category.id),category]};invalidateAbilityStats();}
function openWorkCategoryEditor(context=null){if(!canCreateWorkCategory())return;const form=context?.inline?(context.form||$('#editor-form')):null;if(form){const major=majorIdForPosition(find('positions',form.elements.position_id?.value));if(!major||!canCreateWorkCategory(major)){toast(t('请先选择所属岗位'));return;}let panel=$('#inline-work-category',form);if(panel){panel.hidden=false;return;}const anchor=$('.work-category-field',form);if(!anchor)return;anchor.insertAdjacentHTML('beforeend',`<section id="inline-work-category" class="inline-work-category" data-major="${esc(major)}"><h3>${esc(t('新增作业类别'))}</h3>${workCategoryCreateFields(major,form.elements.skill_category?.value||'operation',true)}<div class="actions">${btn('save-inline-work-category','保存类别','','secondary','')}${btn('cancel-inline-work-category','取消','','link','')}</div><p class="form-error" id="inline-work-category-error" hidden></p></section>`);form.elements.category_name?.focus();return;}
  const majors=data.work_categories.allowed_major_workshop_ids||[],major=filters.major_workshop_id||ownMajorId()||(majors.length===1?majors[0]:'');const epoch=managementEpoch,authority=managementAuthority(data),originRoute=route;
  const submit=async form=>{const current=()=>epoch===managementEpoch&&authority===managementAuthority(data)&&route===originRoute&&editorSubmit===submit&&$('#editor')?.open;if(!current())return;const body=workCategoryCreateBody(form),category=await api('/api/work-categories',{method:'POST',body},{epoch,sequence:bootstrapSequence,isCurrent:current});if(!current())return;rememberWorkCategory(category);closeEditor();if(route==='work_items')render();toast(t('作业类别已添加'));};
  openEditor('新增作业类别','同一大车间的岗位可使用新增类别，已有项目和评分不变。',workCategoryCreateFields(major),submit,'保存类别');
}
async function saveInlineWorkCategory(button){const form=$('#editor-form'),panel=$('#inline-work-category',form),error=$('#inline-work-category-error',form);if(!form||!panel||button.disabled)return;const epoch=managementEpoch,authority=managementAuthority(data),submit=editorSubmit,originRoute=route,position=form.elements.position_id?.value,major=panel.dataset.major;const current=()=>epoch===managementEpoch&&authority===managementAuthority(data)&&route===originRoute&&editorSubmit===submit&&$('#editor')?.open&&$('#editor-form')===form&&$('#inline-work-category',form)===panel&&form.elements.position_id?.value===position&&majorIdForPosition(find('positions',position))===major;
  const save=$('#editor-save');button.disabled=true;if(save)save.disabled=true;if(error)error.hidden=true;
  try{const body=workCategoryCreateBody(form);if(body.major_workshop_id!==major)throw Error(t('所属岗位已变化，请重新添加类别'));const category=await api('/api/work-categories',{method:'POST',body},{epoch,sequence:bootstrapSequence,isCurrent:current});if(!current())return false;rememberWorkCategory(category);const select=form.elements.work_category_id;select.innerHTML=workCategoryOptions(category.id,position);if(form.elements.skill_category)form.elements.skill_category.value=category.base_category;panel.remove();toast(t('作业类别已添加'));return true;}catch(e){if(current()&&error){error.hidden=false;error.textContent=e.message;}return false;}finally{if(current()){button.disabled=false;if(save)save.disabled=false;}else if($('#editor-form')===form&&editorSubmit===submit&&save)save.disabled=false;}}
function cancelInlineWorkCategory(){const panel=$('#inline-work-category');if(panel)panel.remove();}

function skillCategory(value){return ['inspection','data'].includes(value?.skill_category)?value.skill_category:'operation';}
function skillCategoryLabel(value){if(value?.work_category_id){const row=categoryCatalog().find(c=>c.id===value.work_category_id),zh=value.work_category_name||value.work_category_label||row?.name,id=value.work_category_name_id||value.work_category_label_id||row?.name_id;if(zh||id)return lang==='id'?(id||zh):(zh||id);}return t({inspection:'点检',data:'数据',operation:'标准作业'}[skillCategory(value)]);}
function directScale(){const supplied=data.direct_rating_rules?.levels;return [1,2,3,4,5].map(score=>{const row=Array.isArray(supplied)?supplied.find(value=>Number(value.score)===score):null;return {score,label_zh:row?.label_zh||levels[score-1],label_id:row?.label_id||dict[levels[score-1]]||levels[score-1]};});}
function directLevelLabel(level){const row=directScale()[Number(level)];return row?(lang==='id'?row.label_id:row.label_zh):t('未考核');}
function directScoreHint(score){const row=directScale().find(value=>value.score===Number(score));return row?`${row.score} / 5 · ${lang==='id'?row.label_id:row.label_zh}`:t('请选择评分');}
function directGuidancePanel(item,score){const standard=lang==='id'?(item.practical_standard_id||item.practical_standard_zh):(item.practical_standard_zh||item.practical_standard_id);return `<p class="practical-score-hint" aria-live="polite">${esc(directScoreHint(score))}</p><details class="practical-guidance direct-guidance"><summary>${esc(t('评分参考'))}</summary><ol>${directScale().map(row=>`<li value="${row.score}"><strong>${esc(lang==='id'?row.label_id:row.label_zh)}</strong></li>`).join('')}</ol><p>${esc(t('按通用矩阵五档直接评分，不需要题库或考试。'))}</p>${standard?`<strong>${esc(t('本作业考核要点'))}</strong><p class="practical-standard-text">${esc(standard)}</p>`:''}</details>`;}
function assessmentItemGroups(items){const groups=[{key:'exam',label:'考试与实操',items:[]},{key:'inspection',label:'点检',items:[]},{key:'data',label:'数据',items:[]},{key:'other',label:'其他直接评分',items:[]}];for(const item of items){const key=item.work_category_id?'custom:'+(isDirectAssessment(item)?'direct':'exam_practical')+':'+item.work_category_id:isDirectAssessment(item)?(['inspection','data'].includes(skillCategory(item))?skillCategory(item):'other'):'exam';let group=groups.find(g=>g.key===key);if(!group){group={key,label:skillCategoryLabel(item),items:[]};groups.push(group);}group.items.push(item);}return groups.filter(group=>group.items.length);}
function scoringCell(item,cell={}){return {...cell,work_item_id:item.id,assessment_mode:item.assessment_mode||cell.assessment_mode||'exam_practical',skill_category:item.skill_category||cell.skill_category||'operation'};}
function directAssessmentNotice(){return `<div class="notice direct-assessment-notice"><strong>${esc(t('点检和数据技能无需考试，可直接进行五档评分。'))}</strong><br>${esc(t('直接评分不参与理论与实操加权，保存后直接生成月亮图。'))}</div>`;}
function scoreHistoryLink(cell,employee){return permitted('view_results')||permitted('score_practical')?`<button type="button" class="btn link score-history-link" data-action="score-history" data-mode="${isDirectAssessment(cell)?'direct':'exam_practical'}" data-employee="${esc(employee.id)}" data-item="${esc(cell.work_item_id)}" data-assignment="${esc(cell.assignment_id||'')}">${esc(t('查看评分历史'))}</button>`:'';}
function practicalScoreHint(score){const guide=(data.practical_guidance?.scale||[]).find(row=>row.score===Number(score));return guide?`${t('实操参考表现')}：${score} ${lang==='id'?'poin':'分'} · ${lang==='id'?guide.label_id:guide.label_zh}`:t('请选择评分');}
function practicalGuidancePanel(item,score){
  const rows=data.practical_guidance?.scale||[],standard=lang==='id'?(item.practical_standard_id||item.practical_standard_zh):(item.practical_standard_zh||item.practical_standard_id);
  return `<p class="practical-score-hint" aria-live="polite">${esc(practicalScoreHint(score))}</p><details class="practical-guidance"><summary>${esc(t('评分参考'))}</summary><ol>${rows.map(row=>`<li value="${row.score}"><strong>${esc(lang==='id'?row.label_id:row.label_zh)}</strong><span>${esc(lang==='id'?row.description_id:row.description_zh)}</span></li>`).join('')}</ol><p>${esc(lang==='id'?data.practical_guidance?.notice_id:data.practical_guidance?.notice_zh)}</p><strong>${esc(t('本作业考核要点'))}</strong><p class="practical-standard-text">${esc(standard||t('尚未填写，请结合现场作业标准评分。'))}</p></details>`;
}
function submissionReviewPanel(assignment){
  const evidence=assignment.details?.late_submission_evidence,answers=evidence?.answers||{},count=Object.values(answers).filter(answer=>Array.isArray(answer)?answer.length:typeof answer==='string'&&answer.trim()).length;
  const meta=lang==='id'?`Jawaban terlambat terisi: ${count}/${assignment.details?.questions?.length||0}. Diterima: ${formatDate(evidence?.received_at)}`:`迟到答卷已答 ${count}/${assignment.details?.questions?.length||0} 题；收到时间：${formatDate(evidence?.received_at)}`;
  return `<section class="submission-review notice warning"><h3>${esc(t('提交异常待复核'))}</h3><p>${esc(lang==='id'?'Server tidak menerima salinan jawaban sebelum batas waktu. Nilai belum ditetapkan; jawaban terlambat disimpan sebagai bukti.':'截止前服务器未收到可用答卷快照，暂不出分；迟到答案已保留为证据。')}</p>${evidence?`<p>${esc(meta)}</p>`:''}${data.user?.role==='admin'?`<details><summary>${esc(lang==='id'?'Periksa bukti jawaban terlambat':'查看迟到答卷证据')}</summary>${(assignment.details?.questions||[]).map((question,index)=>{const answer=answers[question.id];const keys=Array.isArray(answer)?answer.join(', '):answer||'—';return `<p>${index+1}. ${esc((lang==='id'?question.title_id:question.title_zh)||question.title_zh||question.title_id)}<br><strong>${esc(t('员工答案'))}: ${esc(keys)}</strong></p>`;}).join('')}</details><label class="field"><span>${esc(t('复核说明'))} *</span><textarea id="submission-review-note" maxlength="2000" rows="3" aria-describedby="submission-review-error"></textarea></label><p id="submission-review-error" class="form-error" role="alert" hidden></p><div class="actions"><button type="button" class="btn primary" data-action="review-submission" data-id="${esc(assignment.id)}" data-decision="accept_evidence">${esc(t('核实后采纳迟到答案'))}</button><button type="button" class="btn secondary" data-action="review-submission" data-id="${esc(assignment.id)}" data-decision="require_retest">${esc(t('作废本次异常考试'))}</button></div>`:`<p>${esc(t('请联系系统管理员核对异常提交。'))}</p>`}</section>`;
}
async function reviewSubmission(button){
  if(data.user?.role!=='admin'||button.disabled)return;
  const note=$('#submission-review-note')?.value?.trim()||'',error=$('#submission-review-error');
  if(!note){if(error){error.hidden=false;error.textContent=t('请填写复核依据，不能留空。');}$('#submission-review-note')?.focus();return;}
  const controls=$$('[data-action="review-submission"]');controls.forEach(control=>control.disabled=true);
  try{await api(`/api/assignments/${encodeURIComponent(button.dataset.id)}/review-submission`,{method:'POST',body:{decision:button.dataset.decision,note}});closeEditor();await refresh();toast(t('保存成功'));}
  catch(problem){if(error){error.hidden=false;error.textContent=problem.message;}controls.forEach(control=>control.disabled=false);}
}
function registrationStoreKey(){return 'matrix-exam-registration-pending:'+location.origin;}
function registrationIdentity(value){return {name:String(value.name??value.full_name??'').trim(),employee_no:String(value.employee_no??'').trim(),workshop_id:String(value.workshop_id||'').trim(),position_id:String(value.position_id||'').trim(),assessment_category:String(value.assessment_category||''),round_id:String(value.round_id||'')};}
function registrationIdentityKey(value){const identity=registrationIdentity(value);return JSON.stringify([identity.name,identity.employee_no,identity.workshop_id,identity.position_id,identity.assessment_category,identity.round_id]);}
function pendingRegistration(){
  if(pendingRegistrationLoaded)return normalizePendingRegistrationCategory(pendingRegistrationMemory);
  pendingRegistrationLoaded=true;
  try{const saved=JSON.parse(browserStore.getItem(registrationStoreKey())||'null');if(saved?.version===1&&saved.identity&&typeof saved.identity.name==='string'&&typeof saved.identity.employee_no==='string'&&saved.identity.employee_no.trim()&&typeof saved.identity.workshop_id==='string'&&typeof saved.identity.position_id==='string'&&Object.hasOwn(publicAssessmentNames,saved.identity.assessment_category)&&typeof saved.request_key==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(saved.request_key)){pendingRegistrationMemory={version:1,identity:registrationIdentity(saved.identity),request_key:saved.request_key};if(typeof saved.resolved_path==='string'&&/^\/take\/[A-Za-z0-9_-]{16,100}$/.test(saved.resolved_path))pendingRegistrationMemory.resolved_path=saved.resolved_path;}}catch{}
  return normalizePendingRegistrationCategory(pendingRegistrationMemory);
}
function normalizePendingRegistrationCategory(record){const override=positionAssessmentCategoryOverride(record?.identity?.position_id);return record&&override&&record.identity.assessment_category!==override?savePendingRegistration({...record,identity:{...record.identity,assessment_category:override}}):record;}
function savePendingRegistration(record){pendingRegistrationLoaded=true;pendingRegistrationMemory=record;browserStore.setItem(registrationStoreKey(),JSON.stringify(record));return record;}
function clearPendingRegistration(){pendingRegistrationLoaded=true;pendingRegistrationMemory=null;browserStore.removeItem(registrationStoreKey());const resume=$('#entry-resume');if(resume)resume.hidden=true;}
function invalidateChangedRegistration(identity){const pending=pendingRegistration();if(pending&&registrationIdentityKey(pending.identity)!==registrationIdentityKey(identity))clearPendingRegistration();}
function registrationFor(identity){
  invalidateChangedRegistration(identity);const pending=pendingRegistration();if(pending)return pending;
  if(typeof globalThis.crypto?.getRandomValues!=='function')throw new Error(t('当前浏览器无法安全创建考试入口，请更新浏览器后重试。'));
  const random=new Uint8Array(32);try{globalThis.crypto.getRandomValues(random);}catch{throw new Error(t('当前浏览器无法安全创建考试入口，请更新浏览器后重试。'));}const requestKey=Array.from(random,value=>value.toString(16).padStart(2,'0')).join('');
  return savePendingRegistration({version:1,identity:registrationIdentity(identity),request_key:requestKey});
}
function pendingExamPath(record=pendingRegistration()){const path=record?.resolved_path;return typeof path==='string'&&/^\/take\/[A-Za-z0-9_-]{16,100}$/.test(path)?path:'';}
function pendingExamResumeMarkup(){
  const pending=pendingRegistration();if(!pendingExamPath(pending))return '';
  return `<section id="entry-resume" class="notice entry-resume" aria-labelledby="entry-resume-title"><strong id="entry-resume-title">${lang==='id'?'Lanjutkan ujian sebelumnya':'继续上次考试'}</strong><p>${esc(pending.identity.name)} · ${esc(pending.identity.employee_no)}</p><button type="button" class="btn primary exam-submit" data-action="resume-exam">${esc(lang==='id'?'Lanjutkan ujian yang belum selesai':'继续未完成考试')}${icon('arrow')}</button><p class="security-note">${lang==='id'?'Kembali ke lembar ujian semula. Soal dan waktu mulai tetap sama.':'返回原答卷，保留原题目和开始时间。'}</p></section>`;
}
function completePendingRegistration(){if(examFinished(exam?.assignment)&&pendingExamPath()===location.pathname&&location.pathname.startsWith('/take/'))clearPendingRegistration();}
function readIdentityEntry(){const form=$('#employee-entry-form'),positionId=form?.elements.position_id?.value||(!entryOptions?entryIdentityDraft.position_id:'')||'';return {round_id:entryReadiness(form?.elements.workshop_id?.value,positionId).round_id||'',full_name:form?.elements.full_name?.value||'',employee_no:form?.elements.employee_no?.value||'',workshop_id:form?.elements.workshop_id?.value||(!entryOptions?entryIdentityDraft.workshop_id:'')||'',position_id:positionId,assessment_category:positionAssessmentCategory(positionId,form?.elements.assessment_category?.value),_backup_open:$('#entry-code-backup')?.open||false};}
function renderExamEntry(codeError='',codeInput='',identity=null){
  if(!identity){const saved=pendingRegistration()?.identity;identity=saved?{...saved,full_name:saved.name}:{};}identity={...identity,assessment_category:positionAssessmentCategory(identity.position_id,identity.assessment_category)};entryIdentityDraft={...identity};
  invalidateManagementRequests(true);renderedManagementRoute='';managementChromeKey='';
  clearInterval(timer);document.documentElement.lang=lang==='zh'?'zh-CN':'id';document.title=t('员工考试入口')+' · '+BRAND;
  const workshops=entryOptions?.workshops||[],positions=entryOptions?.positions||[];
  const selectedWorkshop=identity.workshop_id||'';const eligible=positions.filter(position=>positionMatchesWorkshop(position,selectedWorkshop,workshops));
  const optionsNotice=entryOptionsError?'暂时无法获取车间与岗位，可使用考试码进入。':!entryOptions?'正在获取车间与岗位…':selectedWorkshop&&!eligible.length?'当前车间尚未配置岗位，请联系系统管理员。':'';
  $('#app').innerHTML=`<main class="employee-entry-shell"><header class="entry-header"><a class="take-brand" href="/exam"><img class="brand-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt=""><span>${esc(BRAND)}</span></a>${langSelect()}</header><section class="employee-entry-card identity-entry-card"><div class="empty-icon">${icon('clipboard')}</div><h1>${esc(t('员工考试入口'))}</h1><p class="entry-intro">${esc(t('请填写工号、姓名，并选择自己的车间、岗位和人员类别。'))}</p><p class="security-note entry-exam-policy">${esc(t('每场最多50题，不足时按实际题数考试；每题等分，折算100分。'))}</p>${pendingExamResumeMarkup()}<form id="employee-entry-form"><label class="field"><span>姓名 / Nama lengkap *</span><input name="full_name" type="text" value="${esc(identity.full_name||'')}" maxlength="100" required autocomplete="name" placeholder="请输入姓名 / Nama lengkap" aria-describedby="entry-name-help"></label><p class="security-note" id="entry-name-help">姓名可直接填写，无需提前登记。<br>Isi nama Anda tanpa pendaftaran sebelumnya.</p><label class="field"><span>工号 / Nomor Induk Karyawan *</span><input name="employee_no" type="text" value="${esc(identity.employee_no||'')}" maxlength="100" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="请输入真实工号 / Masukkan NIK Anda" aria-describedby="entry-number-help"></label><p class="security-note" id="entry-number-help">请填写本人真实工号，保留开头的 0。<br>Masukkan NIK Anda yang sebenarnya, termasuk angka 0 di awal.</p><label class="field"><span>车间 / Area kerja *</span><select name="workshop_id" required data-dependent="entry-workshop" ${workshops.length?'':'disabled'}>${option('','请选择车间 / Pilih area kerja',selectedWorkshop)}${workshops.map(row=>option(row.id,bilingualEntryName(row),selectedWorkshop)).join('')}</select></label><label class="field"><span>岗位 / Jabatan *</span><select name="position_id" required data-dependent="entry-position" ${eligible.length?'':'disabled'}>${entryPositionOptions(eligible,identity.position_id,selectedWorkshop)}</select></label><div id="entry-current-round">${entryCurrentRound(selectedWorkshop,identity.position_id)}</div><div id="entry-availability">${entryAvailabilityDetails(selectedWorkshop)}</div><label class="field"><span>人员类别 / Kategori karyawan *</span><select name="assessment_category" required data-dependent="entry-category" aria-describedby="entry-category-help">${entryAssessmentCategoryOptions(identity.position_id,identity.assessment_category)}</select></label><p class="security-note entry-category-help" id="entry-category-help">${positionAssessmentCategoryOverride(identity.position_id)?forcedCategoryHelp():'请选择本人实际的人员类别。<br>Pilih kategori karyawan Anda yang sebenarnya.'}</p><div id="entry-options-message" class="notice ${entryOptionsError||selectedWorkshop&&!eligible.length?'warning':''}" role="status" ${optionsNotice?'':'hidden'}>${esc(t(optionsNotice))}</div><div id="identity-entry-error" class="form-error" role="alert" hidden></div><button type="submit" class="btn primary exam-submit" ${eligible.some(position=>entryReadiness(selectedWorkshop,position.id).ready)&&(!identity.position_id||entryReadiness(selectedWorkshop,identity.position_id).ready)?'':'disabled'}>${esc(t('进入考试'))}${icon('arrow')}</button></form><details class="entry-code-backup" id="entry-code-backup" ${identity._backup_open||codeError||entryOptionsError?'open':''}><summary>使用考试码进入 / Masuk dengan kode ujian</summary><p class="security-note">${esc(t('请向车间管理员领取本人的考试码或链接。'))}</p><form id="exam-entry-form"><label class="field"><span>考试码 / Kode ujian</span><input name="exam_entry" type="text" value="${esc(codeInput)}" placeholder="ABCDE FGHJK / 考试链接" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="2048" required aria-describedby="entry-error"></label><div id="entry-error" class="form-error" role="alert" ${codeError?'':'hidden'}>${esc(codeError)}</div><button type="submit" class="btn secondary exam-submit">${esc(t('进入考试'))}${icon('arrow')}</button></form></details><p class="entry-privacy">${icon('shield')}${esc(t('员工不需要登录管理后台。'))}</p></section><footer class="entry-footer"><a href="/login">${esc(t('管理人员登录'))}</a></footer></main>`;
}
async function loadExamOptions(force=false){
  if(entryOptionsLoading||entryOptions&&!force)return;entryOptionsLoading=true;entryOptionsError='';let identityBeforeOptions=null;
  try{const result=await api('/api/exam/options');if(location.pathname==='/exam')identityBeforeOptions=readIdentityEntry();entryOptions={workshops:Array.isArray(result.workshops)?result.workshops:[],positions:Array.isArray(result.positions)?result.positions:[],readiness:Array.isArray(result.readiness)?result.readiness:null,question_count:result.question_count||50,assessment_categories:Array.isArray(result.assessment_categories)?result.assessment_categories:[]};}
  catch(error){entryOptionsError=error.message;}
  finally{entryOptionsLoading=false;if(location.pathname==='/exam'){const identity=identityBeforeOptions||readIdentityEntry(),codeInput=$('#exam-entry-form')?.elements.exam_entry?.value||'';renderExamEntry('',codeInput,identity);}}
}
function updateEntryPositions(){
 const form=$('#employee-entry-form');if(!form)return;const workshopId=form.elements.workshop_id.value,select=form.elements.position_id,current=select.value;
 const choices=(entryOptions?.positions||[]).filter(position=>positionMatchesWorkshop(position,workshopId,entryOptions?.workshops||[]));
 select.innerHTML=entryPositionOptions(choices,current,workshopId);select.disabled=!choices.length;
 updateEntryAvailability();const error=$('#identity-entry-error');if(error)error.hidden=true;
}
function normalizeExamEntry(raw){
  const value=String(raw||'').trim();
  if(value.startsWith('/')||value.includes('://')){
    let url;try{url=new URL(value,location.origin);}catch{throw new Error(t('请填写有效考试码，或本系统的完整考试链接。'));}
    if(url.origin!==location.origin||url.username||url.password)throw new Error(t('考试链接必须来自当前系统。'));
    const match=url.pathname.match(/^\/take\/([A-Za-z0-9_-]{16,100})$/);
    if(!match||url.search||url.hash)throw new Error(t('请填写有效考试码，或本系统的完整考试链接。'));
    return match[1];
  }
  const compact=value.replace(/[\s-]/g,'').toUpperCase();
  if(/^[A-Z0-9]{10}$/.test(compact))return compact;
  if(/^[A-Za-z0-9_-]{16,100}$/.test(value))return value;
  throw new Error(t('请填写有效考试码，或本系统的完整考试链接。'));
}
function openResolvedExam(result){
  if(typeof result.path!=='string'||!/^\/take\/[A-Za-z0-9_-]{16,100}$/.test(result.path))throw new Error(t('无法打开这份考试，请检查考试码或向管理员确认。'));
  const token=result.path.split('/')[2];browserStore.setItem('matrix-exam-lang:'+token,lang);browserStore.setItem('matrix-entry-lang',lang);location.assign(result.path);
}
async function enterExam(form){const code=normalizeExamEntry(form.elements.exam_entry.value);openResolvedExam(await api('/api/exam/resolve',{method:'POST',body:{code}}));}
async function enterIdentityExam(form){
  updateEntryAssessmentCategory();
  const identity=registrationIdentity({full_name:form.elements.full_name.value,employee_no:form.elements.employee_no.value,workshop_id:form.elements.workshop_id.value,position_id:form.elements.position_id.value,assessment_category:positionAssessmentCategory(form.elements.position_id.value,form.elements.assessment_category.value)});
  if(!identity.employee_no)throw new Error('请填写本人真实工号 / Masukkan NIK Anda yang sebenarnya.');
  if(!identity.name||!identity.workshop_id||!identity.position_id||!entryAssessmentCategories().some(category=>category.key===identity.assessment_category))throw new Error(identityEntryInvalid);
  const position=(entryOptions?.positions||[]).find(row=>row.id===identity.position_id);
  if(!positionMatchesWorkshop(position,identity.workshop_id,entryOptions?.workshops||[]))throw new Error(identityEntryInvalid);
  const available=entryReadiness(identity.workshop_id,identity.position_id);if(!available.ready)throw new Error((lang==='id'?available.reason_id:available.reason_zh)||t('暂未开放'));
  identity.round_id=available.round_id||'';const pending=registrationFor(identity),serial=++registrationSubmitSerial;
  const result=await api('/api/exam/register',{method:'POST',body:{...identity,language:lang,request_key:pending.request_key}});
  if(serial!==registrationSubmitSerial)return;
  if(pendingRegistration()?.request_key!==pending.request_key)throw new Error(t('考试资料或轮次已变更，请重新进入考试。'));
  if(typeof result.path!=='string'||!/^\/take\/[A-Za-z0-9_-]{16,100}$/.test(result.path))throw new Error(t('无法打开这份考试，请检查考试码或向管理员确认。'));
  savePendingRegistration({...pending,resolved_path:result.path});openResolvedExam(result);
}
function examEntryError(error,identity){
  if(identity)return error.status===429?t('进入考试操作较频繁，请稍后再试。'):t(error.message);
  return error.status===429?t('尝试次数过多，请一分钟后重试'):error.status===409?t('同车间同岗位有重名员工，请使用考试码进入。'):error.status===404?t('考试码无效或没有对应考试，请核对后重试。'):t(error.message);
}

function managementAuthority(value){return JSON.stringify([value.user?.id,value.user?.role,value.user?.workshop_id,value.permissions||{}]);}
let managementContentRefreshPending=false;
function managementConfiguration(value){return JSON.stringify(['major_workshops','workshops','positions','work_items','question_banks','questions','exam_rounds'].map(key=>value[key]||[]));}
function refreshManagementConfiguration(){
  if(!managementContentRefreshPending||!['dashboard','positions','work_items','questions','plans'].includes(route)||publicLocation())return;
  if($('#editor')?.open)return;
  managementContentRefreshPending=false;
  const content=$('#content'),workspace=$('.workspace'),scroll={x:window.scrollX||0,y:window.scrollY||0,content:content?.scrollTop||0,workspace:workspace?.scrollTop||0};
  render();if(content)content.scrollTop=scroll.content;if(workspace)workspace.scrollTop=scroll.workspace;
  window.scrollTo?.(scroll.x,scroll.y);
}
async function refresh({background=false}={}){
  const epoch=managementEpoch;
  if(background&&bootstrapPending?.epoch===epoch)return bootstrapPending.promise;
  const sequence=++bootstrapSequence;
  const promise=(async()=>{
    let result;try{result=await api('/api/bootstrap',{}, {epoch,sequence});}catch(error){if(!error.sessionExpired&&(epoch!==managementEpoch||sequence!==bootstrapSequence||publicLocation()))return false;throw error;}
    // A previous session, public page, or older response must never restore private state.
    if(epoch!==managementEpoch||sequence!==bootstrapSequence||publicLocation())return false;
    const authorityChanged=managementAuthority(data)!==managementAuthority(result),configurationChanged=managementConfiguration(data)!==managementConfiguration(result);
    if(data.user&&authorityChanged){resetMatrixSession();filters={};matrix=null;practicalData=null;practicalScope='';}
    data=result;sessionChecked=true;
    // Route changes already painted cached data. Background reads must not replace an active form.
    if(!background||authorityChanged){managementContentRefreshPending=false;render();}else{updateManagementChrome();if(configurationChanged&&['dashboard','positions','work_items','questions','plans'].includes(route)){managementContentRefreshPending=true;refreshManagementConfiguration();}else if(route==='results'){renderResultsScoringTable();void loadResultsScoringProgress();}else if(route==='statistics'){renderAbilityStatsContent();void loadAbilityStats();}else if(route==='development'){renderDevelopmentContent();void loadDevelopment();}else if(route==='settings'){renderExamCleanupContent();}}
    return true;
  })();
  bootstrapPending={epoch,sequence,promise};
  try{return await promise;}finally{if(bootstrapPending?.sequence===sequence)bootstrapPending=null;}
}
function managementNavMarkup(){return navGroups.map(([group,items])=>{
  const visible=items.filter(([key])=>canAccessRoute(key));
  return visible.length?`<div class="nav-label">${esc(t(group))}</div>${visible.map(([key,label,ic])=>`<a href="/${esc(key)}" data-route="${esc(key)}">${icon(ic)}<span>${esc(t(label))}</span></a>`).join('')}`:'';
}).join('');}
function updateManagementChrome(){
  if(!data.user||!$('.layout'))return;
  const nav=$('.sidebar .nav'),key=JSON.stringify([lang,managementAuthority(data)]);
  if(nav&&managementChromeKey!==key){const scrollTop=nav.scrollTop;nav.innerHTML=managementNavMarkup();nav.scrollTop=scrollTop;managementChromeKey=key;const brandSubtitle=$('.brand small');if(brandSubtitle)brandSubtitle.textContent=t('岗位与技能评估管理');}
  if(nav)nav.setAttribute('aria-label',lang==='id'?'Navigasi utama':'主导航');const mobileToggle=$('.mobile-toggle');if(mobileToggle)mobileToggle.setAttribute('aria-label',lang==='id'?'Buka navigasi':'打开导航');
  $$('.sidebar [data-route]').forEach(link=>{const active=link.dataset.route===route;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  const breadcrumb=$('.breadcrumb');if(breadcrumb)breadcrumb.innerHTML=`<img class="brand-logo header-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt="">${esc(BRAND)}<span class="breadcrumb-separator" aria-hidden="true">/</span><span>${esc(t(routeNames[route]))}</span>`;
  const actions=$('.top-actions');
  const actionsKey=JSON.stringify([lang,data.user.id,data.user.name,data.user.username,data.user.role]);
  if(actions&&actions.dataset.renderKey!==actionsKey){actions.innerHTML=`${entryLink('header-entry')}${langSelect()}<span class="avatar" aria-hidden="true">${esc((data.user.name||data.user.username||'A').slice(0,1).toUpperCase())}</span><span class="user-info">${esc(data.user.name||data.user.username)}<small>${esc(t(roles[data.user.role]||''))}</small></span><button class="logout" data-action="logout" title="${esc(t('退出登录'))}" aria-label="${esc(t('退出登录'))}">${icon('logout')}</button>`;actions.dataset.renderKey=actionsKey;}
}
function captureContentFocus(content){
  const active=document.activeElement;if(!active||!content?.contains(active))return null;
  const form=active.closest('form');return {id:active.id,name:active.name,type:active.type,value:active.value,filter:active.dataset?.filter,action:active.dataset?.action,formId:form?.id,employee:form?.dataset.employee,item:form?.dataset.item,assignment:form?.dataset.assignment,start:active.selectionStart,end:active.selectionEnd};
}
function restoreContentFocus(content,state){
  if(!state)return;
  let scope=content;if(state.formId)scope=$$('form',content).find(form=>form.id===state.formId);else if(state.employee)scope=$$('form',content).find(form=>form.dataset.employee===state.employee&&form.dataset.item===state.item&&form.dataset.assignment===state.assignment);
  if(!scope)return;
  const active=$$('input,select,textarea,button,a',scope).find(el=>state.id?el.id===state.id:state.filter?el.dataset.filter===state.filter:state.action?el.dataset.action===state.action:state.name&&el.name===state.name&&(!['radio','checkbox'].includes(state.type)||el.value===state.value));
  if(!active||active.disabled)return;active.focus({preventScroll:true});if(typeof state.start==='number'&&typeof active.setSelectionRange==='function'){try{active.setSelectionRange(state.start,state.end);}catch{}}
}
function render(){
  if(location.pathname==='/login'){renderLogin();return;}if(location.pathname==='/exam'){renderExamEntry();loadExamOptions();return;}if(location.pathname.startsWith('/take/')){if(exam)renderExam();else loadExam();return;}if(!data.user){goLogin();return;}
  if(!routeNames[route]||!canAccessRoute(route)){route='dashboard';history.replaceState({},'','/dashboard');}
  document.documentElement.lang=lang==='zh'?'zh-CN':'id';document.title=`${t(routeNames[route])} · ${BRAND}`;
  captureMatrixDrafts();
  const sameRoute=renderedManagementRoute===route,oldContent=$('#content'),focus=sameRoute?captureContentFocus(oldContent):null;
  if(!$('.layout')){
    managementChromeKey='';
    $('#app').innerHTML=`<div class="layout"><aside class="sidebar"><a class="brand" href="/dashboard" data-route="dashboard"><img class="brand-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt=""><span>${esc(BRAND)}<small>${esc(t('岗位与技能评估管理'))}</small></span></a><nav class="nav" aria-label="${esc(lang==='id'?'Navigasi utama':'主导航')}"></nav></aside><main class="workspace"><header class="topbar"><button class="mobile-toggle" data-action="toggle-nav" aria-label="${esc(lang==='id'?'Buka navigasi':'打开导航')}">${icon('menu')}</button><span class="breadcrumb"></span><div class="top-actions"></div></header><div class="content" id="content"></div></main></div>`;
  }
  updateManagementChrome();
  const content=$('#content');
  if(route==='dashboard')content.innerHTML=dashboardPage();
  else if(route==='matrix'){content.innerHTML=matrixPage();const cached=Boolean(matrix&&matrixScope===matrixCurrentScope());if(cached)renderMatrixContent();void loadMatrix({quiet:cached});}
  else if(route==='practical'){content.innerHTML=practicalPage();loadPractical();}
  else if(route==='statistics'){content.innerHTML=abilityStatisticsPage();void loadAbilityStats();}
  else if(route==='development'){content.innerHTML=developmentPage();void loadDevelopment();}
  else if(route==='settings'){content.innerHTML=settingsPage();void loadExamCleanup();}
  else if(route==='plans')content.innerHTML=examRoundsPage();
  else{content.innerHTML=collectionPage();if(route==='results')void loadResultsScoringProgress();}
  if(!sameRoute){content.classList.remove('route-enter');const enteredRoute=route;requestAnimationFrame(()=>{if(route===enteredRoute&&content.isConnected)content.classList.add('route-enter');});}
  renderedManagementRoute=route;restoreContentFocus(content,focus);
}
function workshopExportControls(){
  const own=departmentSelfService()?data.user.workshop_id:'',selected=own||filters.export_workshop_id || data.user.workshop_id || (list('workshops').length===1?list('workshops')[0].id:'');
  return `<div class="export-controls"><label class="sr-only" for="workshop-export-select">${esc(t('选择导出车间'))}</label><select id="workshop-export-select" data-action="export-workshop-select" ${own||!list('workshops').length?'disabled':''}>${selectOptions('workshops',selected,'选择导出车间',workshop=>!own||workshop.id===own)}</select>${btn('export-workshop','导出 Excel',selected?'':'disabled','primary','download')}</div>`;
}
let matrixDownloadSequence=0;
async function downloadMatrixAttachment(url){
  // Native HTTP attachments keep the browser's download filename/lifecycle.
  // Do not turn this file into a Blob URL: some embedded browsers leave those
  // downloads permanently named .crdownload, even when the ZIP is complete.
  const epoch=managementEpoch,authority=managementAuthority(data),current=()=>epoch===managementEpoch&&authority===managementAuthority(data);
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),60000);let response;
  try{response=await fetch(url,{method:'HEAD',credentials:'same-origin',cache:'no-store',signal:controller.signal});}
  catch{if(!current())return false;throw new Error(t('导出失败，请重试。'));}
  finally{clearTimeout(deadline);}
  if(!current())return false;
  if(response.status===401)throw new Error(t('登录已失效，请重新登录后再导出。'));
  if(!response.ok)throw new Error(`${t('导出失败，请重试。')} (${response.status})`);
  if(response.redirected)throw new Error(t('导出失败，请重试。'));
  if(!(response.headers.get('content-type')||'').includes('spreadsheetml')||!/^attachment(?:;|$)/i.test(response.headers.get('content-disposition')||''))throw new Error(t('导出失败，请重试。'));
  const frame=document.createElement('iframe'),link=document.createElement('a');let cleanupTimer;
  frame.name=`matrix-download-${++matrixDownloadSequence}`;frame.hidden=true;frame.title=t('下载能力矩阵');frame.setAttribute('aria-hidden','true');
  const cleanup=()=>{clearTimeout(cleanupTimer);frame.onload=null;frame.onerror=null;frame.remove();};
  frame.onload=()=>{
    // Attachments do not replace the iframe document. A JSON/HTML response
    // means the GET failed after the HEAD check; show that error in this page.
    try{
      const target=frame.contentWindow?.location.href;if(!target||target==='about:blank')return;
      const text=frame.contentDocument?.body?.textContent||'';let message='';
      try{message=JSON.parse(text).error||'';}catch{}
      if(current())toast(message||t('导出失败，请重试。'));cleanup();
    }catch{if(current())toast(t('导出失败，请重试。'));cleanup();}
  };
  frame.onerror=()=>{if(current())toast(t('导出失败，请重试。'));cleanup();};
  document.body.appendChild(frame);link.href=url;link.target=frame.name;link.hidden=true;document.body.appendChild(link);
  // Give the browser time to finish an attachment; no object URL is revoked.
  cleanupTimer=setTimeout(cleanup,300000);
  try{link.click();}catch(error){cleanup();throw error;}finally{link.remove();}
  toast(t('已开始下载，请在浏览器下载列表查看。'));return true;
}
async function exportWorkshop(button){
  const workshopId=route==='matrix'?filters.workshop_id:$('#workshop-export-select')?.value;
  if(!workshopId){toast(t('选择导出车间'));return;}
  const label=button.innerHTML;button.disabled=true;button.textContent=t('正在导出…');
  try{await downloadMatrixAttachment('/api/export/matrix.xlsx?workshop_id='+encodeURIComponent(workshopId));}
  finally{button.innerHTML=label;button.disabled=route==='matrix'?!filters.workshop_id:!$('#workshop-export-select')?.value;}
}
function overviewStats(entries){return `<dl class="overview-stats">${entries.map(([label,value,note])=>`<div class="overview-stat"><dt>${esc(t(label))}</dt><dd><strong>${esc(value)}</strong></dd>${note?`<small>${esc(t(note))}</small>`:''}</div>`).join('')}</dl>`;}
function workflowSteps(steps){return `<div class="workflow-steps">${steps.filter(step=>canAccessRoute(step[0])).map(([destination,title,detail,ic],index)=>`<button class="workflow-step" type="button" data-action="navigate" data-destination="${esc(destination)}"><span class="workflow-step-index">${index+1}</span><span class="workflow-step-copy"><strong>${esc(t(title))}</strong><small>${esc(t(detail))}</small></span>${icon('arrow')}</button>`).join('')}</div>`;}
function recentExamActivity(){
  const rows=list('assignments').slice().sort((a,b)=>String(b.submitted_at||b.created_at||'').localeCompare(String(a.submitted_at||a.created_at||''))).slice(0,3);
  return `<section class="panel recent-activity"><div class="panel-header"><h2>${esc(t('近期考试'))}</h2>${btn('navigate','全部记录','data-destination="results"','link','arrow')}</div><div class="activity-list">${rows.length?rows.map(row=>`<div class="activity-row"><div><strong>${esc(find('employees',row.employee_id)?.name||row.employee_name||'—')}</strong><small>${esc(find('plans',row.plan_id)?.title||row.plan_title||'—')}</small></div><div class="activity-status">${badge(row.status)}${row.status==='completed'?`<strong>${esc(formatScore(row.percent))}<small> / 100</small></strong>`:''}</div>${btn('result-details','查看',`data-id="${esc(row.id)}"`,'link','arrow')}</div>`).join(''):`<p class="dashboard-empty">${esc(t('员工完成开放轮次的考试后，记录会出现在这里。'))}</p>`}</div></section>`;
}
function questionDashboard(){
  const contributor=data.user.role==='question_contributor';
  if(contributor&&permitted('manage_positions')&&permitted('manage_work_items'))return pageHeading('车间工作台','配置岗位和作业项目，上传启用题目，开放考试并完成评分导出。',btn('navigate','查看考试记录','data-destination="results"','secondary','chart'))+overviewStats([['可见题目',list('questions').length,''],['考试记录数',list('assignments').length,''],['待考试',list('assignments').filter(row=>row.status==='assigned').length,'']])+`<section class="panel workflow-panel"><div class="panel-header"><h2>${esc(t('能力评定流程'))}</h2></div>${workflowSteps([['positions','配置岗位','添加本部门适用的岗位。','briefcase'],['work_items','添加作业项目','选择岗位，设置考试与实操或直接评分项目。','list'],['questions','上传并启用题目','上传 Word 或粘贴试题，核对草稿后启用自己的题目。','book'],['plans','开放本部门考试','选择本部门岗位并开放考试轮次。','clipboard'],['practical','现场评分','理论出分后评实操，直接评分项目无需考试。','target'],['matrix','导出能力矩阵','查看评分结果，导出本部门能力矩阵。','download']])}</section><div class="dashboard-bottom">${recentExamActivity()}<section class="panel dashboard-export"><div class="panel-header"><h2>${esc(t('车间导出'))}</h2>${icon('download')}</div><div class="panel-body"><p>${esc(t('一键导出本部门全部岗位的能力矩阵。'))}</p>${workshopExportControls()}</div></section></div>`;
  return pageHeading(contributor?'车间工作台':'题库工作台',permitted('score_practical')?'录入题目，查看考试成绩，完成现场评分。':'录入题目并查看考试记录。',btn('navigate',permitted('score_practical')?'能力矩阵':'题库',`data-destination="${permitted('score_practical')?'matrix':'questions'}"`,'primary',permitted('score_practical')?'grid':'book'))+overviewStats([['可见题目',list('questions').length,''],['考试记录数',list('assignments').length,''],['待考试',list('assignments').filter(row=>row.status==='assigned').length,'']])+`<section class="panel workflow-panel"><div class="panel-header"><h2>${esc(t('日常工作'))}</h2></div>${workflowSteps([['questions','维护题库','按岗位和作业项目录入中印双语题目。','book'],['results','查看考试记录','查看本车间员工的成绩与考试状态。','chart'],...(permitted('score_practical')?[['matrix','现场评分与能力矩阵','考试作业理论出分后可评实操；点检、数据技能可直接评分。','grid']]:[])])}</section>${recentExamActivity()}`;
}
function dashboardPage(){
  if(restrictedQuestionRole())return questionDashboard();
  const configured=list('workshops').filter(w=>w.major_workshop_id).length;
  return pageHeading('能力管理工作台','从岗位题库到现场评分，按流程完成员工能力评定。',btn('navigate','查看能力矩阵','data-destination="matrix"','primary','grid'))+overviewStats([['已配置车间',configured,''],['启用题目',list('questions').filter(q=>q.status==='active').length,''],['员工总数',list('employees').length,''],['考试记录数',list('assignments').length,'']])+`<section class="panel workflow-panel"><div class="panel-header"><h2>${esc(t('能力评定流程'))}</h2><span class="muted">${esc(t('答题分数 + 现场评分 = 能力月亮图'))}</span></div>${workflowSteps([['questions','准备题库','按岗位和作业项目维护题目。','book'],['plans','开放考试','选择车间、岗位并开放考试，员工填写资料即可进入。','clipboard'],['practical','现场评分','理论出分后，现场按 1–5 分评分。','target'],['matrix','查看能力矩阵','自动生成月亮图，按通用矩阵导出。','grid']])}</section><div class="dashboard-bottom">${recentExamActivity()}<section class="panel dashboard-export"><div class="panel-header"><h2>${esc(t('车间导出'))}</h2>${icon('download')}</div><div class="panel-body"><p>${esc(t('一键导出车间全部岗位的能力矩阵。'))}</p>${workshopExportControls()}<p class="security-note">${esc(t('需要选择员工时，请进入能力矩阵页面。'))}</p></div></section></div>`;
}
function entryRoundLabel(row){return (lang==='id'?(row.round_title_id||''):(row.round_title||''))||(row.round_number?(lang==='id'?`Ujian ke-${row.round_number}`:`第${row.round_number}次考试`):t('开放考试'));}
function entryCurrentRound(workshopId,positionId){const row=entryReadiness(workshopId,positionId);if(!row.round_id)return '';return `<div class="notice"><strong>${esc(t('当前开放轮次'))}：${esc(entryRoundLabel(row))}</strong><p>${esc(t('本轮每个工号限考一次'))}</p></div>`;}
function independentRound(round){return (round.workshop_ids||[]).length===1&&!round.migrated_to_round_ids;}
function roundScopeKey(round){return JSON.stringify((round.workshop_ids||[]).slice().sort());}
function nextRoundNumber(round){return Math.max(Number(round.round_number)||0,...list('exam_rounds').filter(r=>independentRound(r)&&roundScopeKey(r)===roundScopeKey(round)).map(r=>Number(r.round_number)||0))+1;}
function chineseRoundNumber(value){const digits='零一二三四五六七八九';let remaining=Number(value),text='',zero=false;if(remaining===10000)return '一万';for(const [divisor,unit] of [[1000,'千'],[100,'百'],[10,'十'],[1,'']]){const digit=Math.floor(remaining/divisor);remaining%=divisor;if(digit){if(zero)text+='零';text+=digits[digit]+unit;zero=false;}else if(text&&remaining)zero=true;}return text.startsWith('一十')?text.slice(1):text;}
function roundDefaultTitles(workshopId,number){const workshop=find('workshops',workshopId);return {title:workshop?`${workshop.name}第${chineseRoundNumber(number)}轮次考试`:'',title_id:workshop?`${workshop.name_id||workshop.name} · Ujian putaran ${number}`:''};}
function roundTitle(round){const defaults=roundDefaultTitles((round.workshop_ids||[])[0],round.round_number);return lang==='id'?(round.title_id||defaults.title_id||`Ujian putaran ${round.round_number}`):(round.title||defaults.title||`第${round.round_number}轮次考试`);}
function roundScopeNames(round,collection,key){const ids=round[key]||[];return ids.map(id=>{const row=find(collection,id);return row?(lang==='id'?(row.name_id||row.name):row.name):'—';}).join('、')||'—';}
function roundPositionReadiness(positionId){
  const items=list('work_items').filter(item=>item.position_id===positionId&&item.active!==false&&!isDirectAssessment(item)),seen=new Set();let total=0,empty=false;
  for(const item of items){
    const bank=hasQuestionBankCatalog()?find('question_banks',item.question_bank_id):null,key=bank?.id||item.id;
    if(seen.has(key))continue;seen.add(key);
    const validBank=bank&&bank.active!==false&&bankPositionId(bank)===positionId&&questionBankItem(bank,positionId);
    const count=hasQuestionBankCatalog()&&!validBank?0:validBank&&Number.isSafeInteger(bank.active_question_count)&&bank.active_question_count>=0?bank.active_question_count:list('questions').filter(q=>q.status==='active'&&!q.merged_into_question_id&&['single','multiple','true_false'].includes(q.type)&&(hasQuestionBankCatalog()?q.question_bank_id===bank.id:q.work_item_id===item.id)).length;
    total+=count;if(!count)empty=true;
  }
  return {count:Math.min(50,total),total,ready:items.length>0&&total>0&&!empty&&items.length<=50,reason:!total?'暂无启用题目':items.length>50?'作业项目超过50项，暂不能考试':empty?'部分作业没有启用题目，暂不能考试':'已有题目可考'};
}
function canManageRound(round){return permitted('manage_exam_rounds')&&Boolean(round)&&independentRound(round)&&(data.user?.role==='admin'||departmentSelfService()&&round.can_manage===true&&round.workshop_ids[0]===data.user.workshop_id);}
function roundPositionFields(round,workshopId,locked=false){
  const positions=list('positions').filter(p=>positionInUserScope(p)&&positionMatchesWorkshop(p,workshopId));
  return positions.length?positions.map(p=>`<label class="checkbox-field"><input type="checkbox" name="position_ids" value="${esc(p.id)}" ${(round.position_ids||[]).includes(p.id)?'checked':''} ${locked?'disabled':''} data-dependent="round-scope">${esc(bilingualEntryName(p))}</label>`).join(''):`<p>${esc(t(workshopId?'没有可选择的岗位':'请先选择编号车间。'))}</p>`;
}
function roundSetupState(){const setup=questionSetupState();if(setup&&setup.route!=='questions')return setup;const own=departmentSelfService()?data.user.workshop_id:'',positions=list('positions').filter(position=>positionInUserScope(position)&&(!own||positionMatchesWorkshop(position,own)));return positions.some(position=>roundPositionReadiness(position.id).ready)?null:{route:'questions',message:'请先上传并启用岗位题目，再开放本部门的考试轮次。',label:'上传并启用题目'};}
function examRoundsPage(){
  const rounds=list('exam_rounds').filter(round=>!round.migrated_to_round_ids).slice().sort((a,b)=>roundScopeNames(a,'workshops','workshop_ids').localeCompare(roundScopeNames(b,'workshops','workshop_ids'),'zh')||(Number(b.round_number)-Number(a.round_number))||String(b.created_at||'').localeCompare(a.created_at||'')),setup=roundSetupState();
  const body=rounds.length?`<div class="table-wrap"><table class="rounds-table"><thead><tr>${['考试轮次','考试范围','选择岗位','考试时长（分钟）','状态','操作'].map(label=>`<th>${esc(t(label))}</th>`).join('')}</tr></thead><tbody>${rounds.map(round=>`<tr><td><strong class="cell-main">${esc(roundTitle(round))}</strong><span class="cell-sub">${esc(lang==='id'?`Putaran ${round.round_number}`:`第 ${round.round_number} 轮`)}</span></td><td>${esc(roundScopeNames(round,'workshops','workshop_ids'))}</td><td>${(round.position_ids||[]).map(id=>{const p=find('positions',id),bank=roundPositionReadiness(id);return `<span class="cell-sub"><strong>${esc(p?(lang==='id'?(p.name_id||p.name):p.name):'—')}</strong> · ${bank.count} ${esc(t('题'))} · ${esc(t(bank.reason))}</span>`;}).join('')}</td><td>${esc(round.duration_minutes)}</td><td><span class="badge ${round.status==='open'?'green':'gray'}">${esc(t(round.status==='open'?'已开放':'已关闭'))}</span></td><td><div class="row-actions">${canManageRound(round)?`${btn('round-edit','编辑',`data-id="${esc(round.id)}"`,'link','')}${btn('round-toggle',round.status==='open'?'关闭考试':'重新开放',`data-id="${esc(round.id)}"`,'link','')}${Number(round.round_number)===nextRoundNumber(round)-1?btn('round-next','开放下一轮',`data-id="${esc(round.id)}"`,'link',''):''}`:`<span class="muted">${esc(t('历史轮次（只读）'))}</span>`}</div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><div class="empty-icon">${icon('clipboard')}</div><h3>${esc(t('没有考试轮次'))}</h3><p>${esc(t(setup?.message||'先启用岗位题目，再开放本部门的考试轮次。'))}</p>${setup&&canAccessRoute(setup.route)?btn('navigate',setup.label,`data-destination="${setup.route}"`):btn('round-create','新增考试轮次')}</div>`;
  return pageHeading('开放考试','选择一个编号车间及岗位，独立开放本车间考试。',btn('round-create','新增考试轮次'))+`<div class="notice">${esc(t('各编号车间独立管理考试轮次，开关和轮次编号互不影响。'))}<br>${esc(t('同一工号每轮只能完成一次考试；开放下一轮后可以再次考试。'))}<br>${esc(t('每场最多50题，不足时按实际题数考试；每题等分，折算100分。'))}</div><section class="panel">${body}</section>`;
}
function roundScopeFields(round={},major='',locked=false){
  const own=departmentSelfService()?data.user.workshop_id:'',workshops=list('workshops').filter(w=>w.major_workshop_id===major&&(!own||w.id===own)),workshopId=own||(round.workshop_ids||[])[0]||'';
  return `${locked||own?`<input type="hidden" name="workshop_id" value="${esc(workshopId)}">`:''}${locked?(round.position_ids||[]).map(id=>`<input type="hidden" name="position_ids" value="${esc(id)}">`).join(''):''}${selectField(locked||own?'round_workshop_display':'workshop_id','编号车间',option('',t('请选择'),workshopId)+workshops.map(w=>option(w.id,bilingualEntryName(w),workshopId)).join(''),`required data-dependent="round-workshop" ${locked||own?'disabled':''}`)}<fieldset class="round-scope-field"><legend>${esc(t('选择岗位'))}</legend><div id="round-position-options" class="round-scope-options">${roundPositionFields(round,workshopId,locked)}</div></fieldset><div id="round-pool-info" class="notice">${esc(t('选择范围后查看实际题数；每场最多50题，不足时使用全部启用题。'))}</div>`;
}
function updateRoundWorkshopScope(){const form=$('#editor-form'),target=$('#round-position-options');if(!form||!target||form.dataset?.roundId)return;const selected=$$('input[name="position_ids"]:checked',form).map(input=>input.value);target.innerHTML=roundPositionFields({position_ids:selected},form.elements.workshop_id?.value||'');updateRoundIdentity();updateRoundPool();}
function updateRoundIdentity(){const form=$('#editor-form');if(!form||form.dataset?.roundId)return;const workshopId=form.elements.workshop_id?.value||'',number=workshopId?nextRoundNumber({workshop_ids:[workshopId],round_number:0}):1,titles=roundDefaultTitles(workshopId,number);for(const [key,value] of Object.entries({...titles,round_number:number})){if(form.elements[key])form.elements[key].value=value;}}
function updateRoundScope(){const form=$('#editor-form'),major=form?.elements.major_workshop_id?.value,target=$('#round-scope-fields');if(target)target.innerHTML=major?roundScopeFields({},major):`<p class="security-note">${esc(t('请先选择大车间。'))}</p>`;updateRoundIdentity();updateRoundPool();}
function updateRoundPool(){const form=$('#editor-form'),target=$('#round-pool-info');if(!form||!target)return;const ids=$$('input[name="position_ids"]:checked',form).map(input=>input.value);target.innerHTML=`<strong>${esc(t('题库可用情况'))}</strong>${ids.length?ids.map(id=>{const p=find('positions',id),state=roundPositionReadiness(id);return `<p>${esc(p?(lang==='id'?(p.name_id||p.name):p.name):'—')}：${state.count} ${esc(t('题'))} · ${esc(t(state.reason))}</p>`;}).join(''):`<p>${esc(t('请选择考试范围'))}</p>`}`;}
function openRoundEditor(id=''){
  if(!permitted('manage_exam_rounds'))return;const round=id?find('exam_rounds',id):{};if(!round||(id&&!canManageRound(round)))return;
  const own=departmentSelfService()?data.user.workshop_id:'',number=round.round_number||1,major=own?ownMajorId():round.major_workshop_id||filters.major_workshop_id||ownMajorId()||'',titles=roundDefaultTitles(own||(round.workshop_ids||[])[0],number);
  const body=`<div class="field-row">${field('title','考试名称（中文）',round.title||titles.title,'text','required maxlength="160"')}${field('title_id','考试名称（印尼文）',round.title_id||titles.title_id,'text','required maxlength="200"')}</div><div class="field-row">${field('round_number','轮次编号',number,'number','required min="1" max="10000" step="1" readonly')}${field('duration_minutes','考试时长（分钟）',round.duration_minutes??30,'number','required min="1" max="480" step="1"')}</div>${selectField(id||own?'round_major_display':'major_workshop_id','大车间',majorSelectOptions(major),`required data-dependent="round-major" ${id||own?'disabled':''}`) + (id||own?`<input type="hidden" name="major_workshop_id" value="${esc(major)}"><p class="security-note">${esc(lang==='id'?'Cakupan putaran sudah tetap. Buat putaran baru untuk mengubah cakupan.':'已建轮次的适用范围固定，调整范围请新建轮次。')}</p>`:'')}<div id="round-scope-fields">${major?roundScopeFields(round,major,Boolean(id)):`<p class="security-note">${esc(t('请先选择大车间。'))}</p>`}</div>${selectField('status','状态',option('open',t('已开放'),round.status||'open')+option('closed',t('已关闭'),round.status||'open'),'required')}<p class="security-note">${esc(t('各编号车间独立管理考试轮次，开关和轮次编号互不影响。'))}<br>${esc(t('开放后，员工从统一考试入口直接填写资料进入，不需要分配考试。'))}</p>`;
  openEditor(id?'编辑考试轮次':'新增考试轮次','同一工号每轮只能完成一次考试；开放下一轮后可以再次考试。',body,async form=>{const f=new FormData(form),workshopId=String(f.get('workshop_id')||''),payload={title:String(f.get('title')||'').trim(),title_id:String(f.get('title_id')||'').trim(),round_number:Number(f.get('round_number')),major_workshop_id:f.get('major_workshop_id'),workshop_ids:workshopId?[workshopId]:[],position_ids:f.getAll('position_ids'),duration_minutes:Number(f.get('duration_minutes')),status:f.get('status')};if(!workshopId||!payload.position_ids.length)throw new Error(t('请选择一个编号车间和至少一个岗位。'));if(!permitted('manage_exam_rounds')||id&&!canManageRound(find('exam_rounds',id))||departmentSelfService()&&(workshopId!==data.user.workshop_id||payload.major_workshop_id!==ownMajorId())||payload.position_ids.some(positionId=>!positionMatchesWorkshop(find('positions',positionId),workshopId)))throw new Error(t('只能管理本部门的考试轮次。'));await api('/api/exam_rounds'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:payload});closeEditor();entryOptions=null;await refresh();toast(t('保存成功'));},'保存');const form=$('#editor-form');if(form)form.dataset.roundId=id;updateRoundIdentity();updateRoundPool();
}
async function toggleExamRound(button){const round=find('exam_rounds',button.dataset.id);if(!canManageRound(round))return;openEditor(round.status==='open'?'关闭考试':'重新开放',round.status==='open'?'关闭后尚未开始的员工不能进入，已开始答题的员工可继续交卷。':'同一工号每轮只能完成一次考试；开放下一轮后可以再次考试。',`<div class="notice">${esc(roundTitle(round))}</div><p class="security-note">${esc(t('只调整本车间，其他车间不受影响。'))}</p>`,async()=>{if(!canManageRound(find('exam_rounds',round.id)))throw new Error(t('只能管理本部门的考试轮次。'));await api('/api/exam_rounds/'+encodeURIComponent(round.id),{method:'PUT',body:{...round,status:round.status==='open'?'closed':'open'}});closeEditor();entryOptions=null;await refresh();toast(t('保存成功'));},round.status==='open'?'关闭考试':'开放本轮');}
function openNextRound(id){const round=find('exam_rounds',id);if(!canManageRound(round))return;const titles=roundDefaultTitles(round.workshop_ids[0],nextRoundNumber(round));openEditor('开放下一轮','开放下一轮后，本轮将关闭；已开始的考试可以继续完成。',`<div class="notice">${esc(roundTitle(round))} → ${esc(lang==='id'?titles.title_id:titles.title)}</div><p class="security-note">${esc(t('只调整本车间，其他车间不受影响。'))}</p>`,async()=>{if(!canManageRound(find('exam_rounds',id)))throw new Error(t('只能管理本部门的考试轮次。'));await api('/api/exam-rounds/'+encodeURIComponent(id)+'/next',{method:'POST',body:{}});closeEditor();entryOptions=null;await refresh();toast(t('考试已开放'));},'开放下一轮');}

const cfg={company:{collection:'workshops',empty:'还没有车间',hint:'请先新增车间，然后设置岗位。',columns:['名称','所属大车间','编号','负责人','说明']},positions:{collection:'positions',empty:'还没有岗位',hint:'添加本部门岗位，再配置岗位下的作业项目。',columns:['名称','所属大车间','说明']},work_items:{collection:'work_items',empty:'还没有作业项目',hint:'选择已有岗位，添加具体作业项目；考试与实操项目可上传题目。',columns:['名称','所属岗位','作业类别','考核方式','排序','状态']},questions:{collection:'questions',empty:'还没有题目',hint:'选择岗位和作业题库，上传 Word 或粘贴题目后核对并导入。',columns:['题目','所属作业项目','评价维度','题型','原题分值','状态']},employees:{collection:'employees',empty:'还没有员工',hint:'先录入员工并指定车间、岗位、人员类别和答题语言。',columns:['员工姓名','工号','所属车间','所属岗位','人员类别','答题语言','状态']},plans:{collection:'plans',empty:'还没有考试计划',hint:'每场最多50题，不足时按实际题数考试，可设置时长和及格线。',columns:['考试名称','所属岗位','实际题数','可用题目','考试时长（分钟）','状态']},results:{collection:'assignments',empty:'还没有考试记录',hint:'员工完成开放轮次的考试后，记录会出现在这里。',columns:['员工','考试名称','理论成绩','考试状态','实操评分','提交时间']},users:{collection:'users',empty:'暂无数据',hint:'后台账号与车间范围；员工答题不需要在这里开户。',columns:['显示名称','登录名','角色','所属车间','状态']}};
function collectionPage(){const c=cfg[route];let actions='';if(route==='work_items'&&canCreateWorkCategory())actions+=btn('create-work-category','新增作业类别','','secondary','plus');if(route==='questions'&&permitted('export_question_answers'))actions+=`<a class="btn secondary" href="/api/export/questions.csv${filters.position_id?'?position_id='+encodeURIComponent(filters.position_id):''}">${icon('download')}${esc(t('导出 CSV'))}</a>`;if(route==='questions'&&permitted('add_questions'))actions+=btn('import','导入题库',questionPrerequisiteMissing()?'disabled':'','secondary','download');if(route==='results')actions+=btn('results-scoring-refresh','刷新评分状态','','secondary','');if(route==='results'&&permitted('score_practical'))actions+=btn('goto-practical','现场实操评分','','secondary','target');if(route==='results'&&permitted('view_results'))actions+=`<a class="btn secondary" href="/api/export/results.csv${filters.position_id?'?position_id='+encodeURIComponent(filters.position_id):''}">${icon('download')}${esc(t('导出 CSV'))}</a>`;if(canWrite(c.collection)&&route!=='results')actions+=btn('create','新增',`data-collection="${c.collection}"${route==='questions'&&questionPrerequisiteMissing()?' disabled':''}`);let notice=data.user.role==='question_contributor'?`<div class="notice">${esc(t(route==='questions'?'可上传、编辑并启用自己提交的题目，供本部门考试使用。':'按岗位配置、题库、考试和评分流程完成本部门能力评定。'))}</div>`:data.user.role==='question_editor'?`<div class="notice">${esc(t('题目可编辑，考试记录只读。'))}</div>`:data.user.role==='viewer'?`<div class="notice">${esc(t('只读账号可以查看数据，不能新增、修改或分配考试。'))}</div>`:'';if(route==='work_items'&&data.user.role==='question_contributor')notice=`<div class="notice">${esc(t('可添加作业项目和作业类别；自己创建的项目可编辑，其他项目只读。'))}</div>`;if(route==='results'&&restrictedQuestionRole())notice+=`<div class="notice">${esc(t('考试记录仅显示成绩与状态，不显示题目答案或员工考试码。'))}</div>`;if(route==='questions'&&permitted('add_questions'))notice+=questionSetupNotice();const rows=filteredRows();const description=hasQuestionBankCatalog()&&route==='work_items'?'同一大车间的同岗位共用题库；不同岗位分别维护，点检和数据技能仍按岗位评分。':hasQuestionBankCatalog()&&route==='questions'?'同一大车间内，同一岗位共用题库；不同岗位分别维护。':descriptions[route];return pageHeading(routeNames[route],description,actions)+notice+(route==='work_items'?workCategorySummary():'')+`<section class="panel">${toolbar()}<div id="table-content">${tableBody(rows)}</div></section>`;}
function toolbar(){
  let parent='';const hierarchy=['company','positions','work_items','questions','plans'].includes(route);
  if(hierarchy){if(data.user.role!=='admin'&&ownMajorId()&&!filters.major_workshop_id)filters.major_workshop_id=ownMajorId();parent+=`<select data-filter="major_workshop_id" aria-label="${esc(t('全部大车间'))}">${majorSelectOptions(filters.major_workshop_id,'全部大车间',route!=='company')}</select>`;}
  if(['employees','users','results'].includes(route))parent+=`<select data-filter="workshop_id" aria-label="${esc(t('全部车间'))}">${selectOptions('workshops',filters.workshop_id,'全部车间',workshop=>route!=='results'||abilityStatsWorkshops().some(allowed=>allowed.id===workshop.id))}</select>`;
  if(['work_items','questions','plans','results','employees'].includes(route))parent+=`<select data-filter="position_id" aria-label="${esc(t('全部岗位'))}">${positionOptions(filters.position_id,'全部岗位',p=>(!filters.major_workshop_id||positionMatchesMajor(p,filters.major_workshop_id))&&(!filters.workshop_id||positionMatchesWorkshop(p,filters.workshop_id)))}</select>`;
  if(route==='results')parent+=`<select data-filter="result_score" aria-label="${esc(t('成绩筛选'))}">${option('',t('全部成绩'),filters.result_score||'')}${option('below60',t('只看低于60分'),filters.result_score||'')}</select>`;
  if(route==='questions')parent+=`<select data-filter="${hasQuestionBankCatalog()?'question_bank_id':'work_item_id'}" aria-label="${esc(t(hasQuestionBankCatalog()?'全部共用题库':'全部作业项目'))}">${questionWorkItemFilterOptions()}</select>`;
  if(route==='questions')parent+=`<select data-filter="question_status" aria-label="${esc(t('题目状态'))}">${questionStatusFilterOptions()}</select>`;
  return `<div class="table-toolbar"><input type="search" data-filter="search" placeholder="${esc(t('搜索名称、编号或题目'))}" aria-label="${esc(t('搜索名称、编号或题目'))}" value="${esc(filters.search||'')}">${parent}<span style="margin-left:auto;font-size:10px;color:#6B7B84">${esc(t('仅显示你有权限查看的车间数据。'))}</span></div>`;
}
function resultWorkshopId(row){return row.workshop_id||find('employees',row.employee_id)?.workshop_id||'';}
function resultPositionId(row){return find('plans',row.plan_id)?.position_id||row.details?.position_id||find('employees',row.employee_id)?.position_id||'';}
function nameScriptRank(name){
  const value=String(name||'');
  if(/\p{Script=Han}/u.test(value))return 0;
  if(/\p{Script=Latin}/u.test(value))return 1;
  return 2;
}
function resultNameScriptRank(row){return nameScriptRank(find('employees',row.employee_id)?.name||row.employee_name||'');}
function sortNameAndPositionRows(rows,nameForRow,positionForRow){
  const positionOrder=new Map(list('positions').map((position,index)=>[position.id,index]));
  return rows.map((row,index)=>({row,index,position:positionOrder.get(positionForRow(row))??positionOrder.size,nameRank:nameScriptRank(nameForRow(row))}))
    .sort((a,b)=>a.nameRank-b.nameRank||a.position-b.position||a.index-b.index).map(entry=>entry.row);
}
function sortResultRows(rows){return sortNameAndPositionRows(rows,row=>find('employees',row.employee_id)?.name||row.employee_name||'',resultPositionId);}
function sortEmployeeRows(rows){return sortNameAndPositionRows(rows,row=>row.name,row=>row.position_id||'');}
function sortAssessmentEmployeeRows(rows){return sortNameAndPositionRows(rows||[],row=>row.employee?.name,row=>row.employee?.position_id||'');}
function isLowTheoryResult(row){return row.status==='completed'&&typeof row.percent==='number'&&Number.isFinite(row.percent)&&row.percent>=0&&row.percent<60;}
function resultTheoryScoreMarkup(row){
  if(row.status!=='completed')return esc(t(row.submission_review_required?'提交异常待复核':row.status==='voided'?'已作废，需重新考试':row.status==='pending_review'?'待批改':'未提交'));
  if(typeof row.percent!=='number'||!Number.isFinite(row.percent)||row.percent<0||row.percent>100)return '<span class="cell-main">—</span>';
  const low=isLowTheoryResult(row);
  return `<span class="cell-main${low?' result-low-score':''}">${esc(formatScore(row.percent))}%</span>${low?`<span class="badge red result-low-label">${esc(t('低于60分'))}</span>`:''}`;
}
// Ability statistics: one valid saved assessment per employee x applicable item.
const abilityStatsColors=['#b45d58','#c68635','#c2a33e','#438578','#416da5'];
let abilityStatsFilters={major_workshop_id:'',workshop_id:'',position_id:'',skill_category:'all'};
let abilityStatsSnapshot=null,abilityStatsPending=null,abilityStatsError='',abilityStatsRequest=0;
function invalidateAbilityStats(resetFilters=false){invalidateDevelopment(resetFilters);invalidateExamCleanup();abilityStatsRequest++;abilityStatsSnapshot=null;abilityStatsPending=null;abilityStatsError='';if(resetFilters)abilityStatsFilters={major_workshop_id:'',workshop_id:'',position_id:'',skill_category:'all'};}
function abilityStatsRevision(){return JSON.stringify([resultsScoringRevision(),list('workshops').map(workshop=>[workshop.id,workshop.major_workshop_id]),list('positions').map(position=>[position.id,position.major_workshop_id,position.workshop_id]),list('work_items').map(item=>[item.id,item.skill_category,item.work_category_id,item.work_category_name,item.work_category_name_id]),list('employees').map(employee=>[employee.id,employee.assessment_category]),data.rating_rules?.version,data.direct_rating_rules?.version]);}
function abilityStatsCatalog(){return {workshops:abilityStatsWorkshops(),positions:list('positions')};}
function abilityStatsWorkshops(){const own=data.user?.workshop_id;return list('workshops').filter(workshop=>data.user?.role==='admin'||!own||workshop.id===own);}
function abilityStatsMajors(){const workshops=abilityStatsWorkshops(),ids=new Set(workshops.map(workshop=>workshop.major_workshop_id));return list('major_workshops').filter(major=>data.user?.role==='admin'||ids.has(major.id));}
function abilityStatsCellLevel(row,item,cell){
  if(!cell||cell.work_item_id!==item.id||!Number.isInteger(cell.level)||cell.level<0||cell.level>4||!Number.isInteger(cell.practical_score)||cell.practical_score<1||cell.practical_score>5)return null;
  if(isDirectAssessment(item))return isDirectAssessment(cell)&&cell.assessment_status==='completed'&&!cell.assignment_id&&cell.level===cell.practical_score-1?cell.level:null;
  const percent=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
  if(isDirectAssessment(cell)||!row.latest_assignment_id||cell.assignment_id!==row.latest_assignment_id||!percent(cell.theory_exam_percent)||!percent(cell.theory_item_percent??cell.knowledge_percent)||!percent(cell.final_percent)||!Number.isInteger(cell.question_count)||cell.question_count<=0||cell.assessment_status!=='completed')return null;
  return cell.level;
}
function aggregateAbilityStats(source,scope={},catalog=abilityStatsCatalog()){
  const counts=[0,0,0,0,0],seenEmployees=new Set(),seenItems=new Set(),workshops=new Map((catalog.workshops||[]).map(workshop=>[workshop.id,workshop])),positions=new Map((catalog.positions||[]).map(position=>[position.id,position]));
  const items=(Array.isArray(source?.items)?source.items:[]).filter(item=>{if(!item||typeof item.id!=='string'||!item.id||seenItems.has(item.id)||item.active!==true)return false;seenItems.add(item.id);return true;});
  let employeeCount=0;
  for(const row of Array.isArray(source?.rows)?source.rows:[]){
    const employee=row?.employee,workshop=workshops.get(employee?.workshop_id),position=positions.get(employee?.position_id);
    if(!employee||typeof employee.id!=='string'||!employee.id||seenEmployees.has(employee.id)||!workshop||!position||!positionMatchesWorkshop(position,workshop.id,catalog.workshops||[]))continue;
    seenEmployees.add(employee.id);
    if(scope.major_workshop_id&&workshop.major_workshop_id!==scope.major_workshop_id||scope.workshop_id&&workshop.id!==scope.workshop_id||scope.position_id&&position.id!==scope.position_id)continue;
    const applicable=items.filter(item=>item.position_id===position.id&&(!scope.skill_category||scope.skill_category==='all'||skillCategory(item)===scope.skill_category));
    let hasAssessment=false;
    for(const item of applicable){const cell=(Array.isArray(row.cells)?row.cells:[]).find(cell=>cell.work_item_id===item.id),level=abilityStatsCellLevel(row,item,cell);if(level==null)continue;counts[level]++;hasAssessment=true;}
    if(hasAssessment)employeeCount++;
  }
  const total=counts.reduce((sum,count)=>sum+count,0),independent=counts[3]+counts[4];
  return {employeeCount,total,assessed:total,independent,counts,independenceRate:total?independent/total*100:null};
}
function abilityStatsPercent(value){return value==null?'—':`${formatScore(Number(value.toFixed(1)))}%`;}
function abilityStatsChart(stats,label){
  const labels=levels,slices=[];let angle=-Math.PI/2;
  for(let index=0;index<stats.counts.length;index++){const count=stats.counts[index];if(!count||!stats.total)continue;const delta=count/stats.total*Math.PI*2,next=angle+delta,title=`${t(labels[index])}: ${count} ${t('项')} · ${abilityStatsPercent(count/stats.total*100)}`;
    if(count===stats.total)slices.push(`<circle cx="120" cy="120" r="108" fill="${abilityStatsColors[index]}"><title>${esc(title)}</title></circle>`);
    else slices.push(`<path d="M 120 120 L ${120+108*Math.cos(angle)} ${120+108*Math.sin(angle)} A 108 108 0 ${delta>Math.PI?1:0} 1 ${120+108*Math.cos(next)} ${120+108*Math.sin(next)} Z" fill="${abilityStatsColors[index]}" stroke="#fff" stroke-width="1.5"><title>${esc(title)}</title></path>`);
    angle=next;
  }
  const summary=labels.map((text,index)=>`${t(text)} ${stats.counts[index]} ${t('项')}`).join('；');
  const svg=`<svg class="ability-stats-pie" viewBox="0 0 240 240" role="img" aria-label="${esc(label+'：'+summary)}"><title>${esc(label)}</title>${stats.total?slices.join(''):`<circle cx="120" cy="120" r="108" fill="#f0f1f3"/><text x="120" y="125" text-anchor="middle" fill="#626874" font-size="14">${esc(lang==='id'?'Belum ada penilaian':'暂无评定结果')}</text>`}</svg>`;
  const legend=`<ul class="ability-stats-legend" aria-label="${esc(lang==='id'?'Jumlah dan proporsi setiap tingkat':'各能力等级数量及占比')}">${labels.map((label,index)=>`<li class="ability-stats-legend-item"><span class="ability-stats-legend-color" style="background:${abilityStatsColors[index]}" aria-hidden="true"></span><span class="ability-stats-legend-name">${esc(t(label))}</span><strong class="ability-stats-legend-count">${stats.counts[index]} ${esc(t('项'))}</strong><span class="ability-stats-legend-percent">${stats.total?abilityStatsPercent(stats.counts[index]/stats.total*100):'—'}</span></li>`).join('')}</ul>`;
  return `<div class="ability-stats-chart-layout">${svg}${legend}</div>`;
}
function abilityStatsMetrics(stats){return `<dl class="ability-stats-metrics">${[[lang==='id'?'Karyawan yang dinilai':'已评定员工数',stats.employeeCount,lang==='id'?'Minimal satu keterampilan dinilai dalam cakupan ini':'当前范围内至少一项技能已评定'],[lang==='id'?'Item keterampilan dinilai':'已评定技能项数',stats.assessed,lang==='id'?'Karyawan × item kerja yang sudah dinilai':'按员工 × 已评定作业项目统计'],[lang==='id'?'Mampu bekerja mandiri':'独立作业率',abilityStatsPercent(stats.independenceRate),`${stats.independent} / ${stats.assessed} ${t('项')}`]].map(([label,value,hint])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd><small>${esc(hint)}</small></div>`).join('')}</dl>`;}
function abilityStatsNormalize(){
  const scope=abilityStatsFilters,workshops=abilityStatsWorkshops();
  if(scope.major_workshop_id&&!abilityStatsMajors().some(major=>major.id===scope.major_workshop_id))scope.major_workshop_id='';
  if(scope.workshop_id&&!workshops.some(workshop=>workshop.id===scope.workshop_id&&(!scope.major_workshop_id||workshop.major_workshop_id===scope.major_workshop_id)))scope.workshop_id='';
  const allowedWorkshops=workshops.filter(workshop=>(!scope.major_workshop_id||workshop.major_workshop_id===scope.major_workshop_id)&&(!scope.workshop_id||workshop.id===scope.workshop_id));
  if(scope.position_id&&!list('positions').some(position=>position.id===scope.position_id&&allowedWorkshops.some(workshop=>positionMatchesWorkshop(position,workshop.id,workshops))))scope.position_id='';
}
function abilityStatsToolbar(){
  abilityStatsNormalize();const scope=abilityStatsFilters,workshops=abilityStatsWorkshops(),available=workshops.filter(workshop=>(!scope.major_workshop_id||workshop.major_workshop_id===scope.major_workshop_id)&&(!scope.workshop_id||workshop.id===scope.workshop_id));
  const field=(label,key,options)=>`<label class="field"><span>${esc(label)}</span><select data-stats-filter="${key}">${options}</select></label>`;
  return `<section class="panel ability-stats-toolbar">${field(t('所属大车间'),'major_workshop_id',option('',lang==='id'?'Semua area utama':'全部大车间',scope.major_workshop_id)+abilityStatsMajors().map(major=>option(major.id,lang==='id'?(major.name_id||major.name):major.name,scope.major_workshop_id)).join(''))}${field(t('编号车间'),'workshop_id',option('',lang==='id'?'Semua unit':'全部编号车间',scope.workshop_id)+workshops.filter(workshop=>!scope.major_workshop_id||workshop.major_workshop_id===scope.major_workshop_id).map(workshop=>option(workshop.id,lang==='id'?(workshop.name_id||workshop.name):workshop.name,scope.workshop_id)).join(''))}${field(t('所属岗位'),'position_id',option('',t('全部岗位'),scope.position_id)+list('positions').filter(position=>available.some(workshop=>positionMatchesWorkshop(position,workshop.id,workshops))).map(position=>option(position.id,lang==='id'?(position.name_id||position.name):position.name,scope.position_id)).join(''))}${field(lang==='id'?'Jenis keterampilan':'技能范围','skill_category',[['all','全部技能','Semua keterampilan'],['operation','标准作业','Pekerjaan standar'],['inspection','点检','Inspeksi'],['data','数据','Data']].map(([key,zh,id])=>option(key,lang==='id'?id:zh,scope.skill_category)).join(''))}</section>`;
}
function abilityStatisticsPage(){return pageHeading('能力统计','按已评定员工的技能项目，查看五档能力分布。',btn('stats-refresh','刷新统计','','secondary',''))+`<div class="notice ability-stats-notice">${esc(lang==='id'?'Hanya karyawan dan keterampilan dengan hasil penilaian sah yang dihitung. Item yang belum dinilai tidak termasuk dalam jumlah atau persentase.':'仅统计已有有效评定结果的员工和技能项目，未评分项目不计入数量或占比。')}</div><div id="ability-stats-controls">${abilityStatsToolbar()}</div><div id="ability-stats-content">${abilityStatsLoading()}</div>`;}
function abilityStatsLoading(){return `<div class="loading ability-stats-loading"><span class="spinner"></span>${esc(t('正在加载…'))}</div>`;}
function abilityStatsDefinitions(){return `<details class="panel ability-stats-definitions"><summary>${esc(lang==='id'?'Definisi dan cakupan statistik':'统计口径与范围')}</summary><div><p>${esc(lang==='id'?'Satu pengamatan = satu karyawan × satu keterampilan aktif yang berlaku pada jabatannya dan memiliki hasil penilaian sah. Seorang karyawan dihitung sekali jika minimal satu keterampilan dalam cakupan terpilih sudah dinilai; ini tidak berarti semua keterampilannya sudah dinilai. Arsip nonaktif yang memenuhi syarat tetap termasuk.':'统计单位为“员工 × 适用作业项目”，仅纳入当前岗位启用且已有有效评定的项目。员工在当前筛选范围内至少一项技能已评定即计为一人，不代表该员工全部技能均已评完；符合条件的停用档案仍计入。')}</p><p>${esc(lang==='id'?'Proporsi setiap tingkat = jumlah item pada tingkat tersebut ÷ semua item yang sudah dinilai. Kemampuan mandiri = item mampu mandiri atau mengajar orang lain ÷ semua item yang sudah dinilai. Tanpa penyebut, ditampilkan —.':'五档占比 = 各档已评定项数 ÷ 全部已评定项数。独立作业率 =“可独立完成 + 可指导他人”项数 ÷ 全部已评定项数；分母为零时显示“—”。')}</p><p>${esc(lang==='id'?'Pekerjaan standar mengikuti hasil ujian terakhir yang telah dinilai dan praktik tersimpan. Inspeksi dan data menggunakan penilaian langsung tersimpan. Item tanpa hasil sah tidak dimasukkan dalam statistik.':'标准作业使用最近已出分考试与已保存实操生成的等级；点检、数据使用已保存直接评分。尚无有效评定结果的项目不参与统计。')}</p><p>${esc(lang==='id'?'Persentase gabungan dihitung dari total item yang sudah dinilai, bukan rata-rata persentase unit. Statistik ini hanya mewakili karyawan dan keterampilan yang sudah dinilai. Bandingkan unit pada jabatan dan keterampilan yang sama. Sumber: hasil tersimpan pada matriks kompetensi; waktu yang ditampilkan adalah waktu pembacaan.':'总体比例按已评定项目总数计算，不取车间比例的平均值，仅代表已评定员工和技能的情况。比较车间时，请筛选相同岗位和技能范围。来源为系统能力矩阵已保存结果；页面时间为读取时间。')}</p></div></details>`;}
function abilityStatsScopeTitle(){const scope=abilityStatsFilters;if(scope.workshop_id)return nameOf('workshops',scope.workshop_id);if(scope.major_workshop_id)return majorName(scope.major_workshop_id);return lang==='id'?(data.user?.role==='admin'?'Ikhtisar pabrik':'Ikhtisar lingkup akses'):(data.user?.role==='admin'?'全厂总览':'权限范围总览');}
function renderAbilityStatsContent(){
  if(route!=='statistics')return;const target=$('#ability-stats-content');if(!target)return;const controls=$('#ability-stats-controls'),focusKey=document.activeElement?.dataset?.statsFilter;if(controls){controls.innerHTML=abilityStatsToolbar();if(Object.hasOwn(abilityStatsFilters,focusKey))$('[data-stats-filter="'+focusKey+'"]',controls)?.focus?.({preventScroll:true});}
  const refreshButton=$('[data-action="stats-refresh"]');if(refreshButton)refreshButton.disabled=Boolean(abilityStatsPending);
  if(abilityStatsError){target.innerHTML=`<section class="panel"><div class="empty ability-stats-empty"><h3>${esc(lang==='id'?'Statistik gagal dimuat':'统计读取失败')}</h3><p>${esc(lang==='id'?'Segarkan statistik untuk mencoba lagi.':'请点击刷新统计重试。')}</p></div></section>`;return;}
  if(!abilityStatsSnapshot||abilityStatsSnapshot.authority!==managementAuthority(data)||abilityStatsSnapshot.revision!==abilityStatsRevision()){target.innerHTML=abilityStatsLoading();return;}
  const source=abilityStatsSnapshot.source,scope=abilityStatsFilters,catalog=abilityStatsCatalog(),summary=aggregateAbilityStats(source,scope,catalog),title=abilityStatsScopeTitle();
  const header=`<header class="panel-header"><div><h2>${esc(title)}</h2><p>${summary.total} ${esc(lang==='id'?'item keterampilan dinilai':'项已评定技能')} · ${esc(scope.position_id?nameOf('positions',scope.position_id):t('全部岗位'))} · ${esc(scope.skill_category==='all'?(lang==='id'?'Semua keterampilan':'全部技能'):skillCategoryLabel({skill_category:scope.skill_category}))}</p></div><time datetime="${esc(abilityStatsSnapshot.readAt)}">${esc(lang==='id'?'Dibaca pada ':'读取于 ')}${esc(formatDate(abilityStatsSnapshot.readAt))}</time></header>`;
  let detail='';
  if(!scope.workshop_id){
    const groups=scope.major_workshop_id?abilityStatsWorkshops().filter(workshop=>workshop.major_workshop_id===scope.major_workshop_id).map(workshop=>({key:'workshop_id',id:workshop.id,label:lang==='id'?(workshop.name_id||workshop.name):workshop.name})):abilityStatsMajors().map(major=>({key:'major_workshop_id',id:major.id,label:lang==='id'?(major.name_id||major.name):major.name}));
    detail=`<section class="ability-stats-breakdown"><h2>${esc(scope.major_workshop_id?(lang==='id'?'Unit kerja':'各编号车间'):(lang==='id'?'Area utama':'各大车间'))}</h2><div class="ability-stats-workshops">${groups.map(group=>{const stats=aggregateAbilityStats(source,{...scope,[group.key]:group.id},catalog);return `<section class="panel ability-stats-workshop"><header class="panel-header"><h3>${esc(group.label)}</h3><button class="btn link" data-action="stats-drill" data-key="${group.key}" data-id="${esc(group.id)}">${esc(group.key==='major_workshop_id'?(lang==='id'?'Lihat unit':'查看编号车间'):(lang==='id'?'Lihat rincian':'查看本车间'))}</button></header>${abilityStatsChart(stats,group.label)}${abilityStatsMetrics(stats)}</section>`;}).join('')}</div></section>`;
  }
  target.innerHTML=`<section class="panel ability-stats-summary">${header}${abilityStatsChart(summary,title)}${abilityStatsMetrics(summary)}</section>${detail}${abilityStatsDefinitions()}`;
}
async function loadAbilityStats({force=false}={}){
  if(route!=='statistics'||!data.user||!canAccessRoute('statistics'))return false;
  const authority=managementAuthority(data),revision=abilityStatsRevision();
  if(!force&&abilityStatsSnapshot?.authority===authority&&abilityStatsSnapshot.revision===revision){renderAbilityStatsContent();return true;}
  if(!force&&abilityStatsPending?.authority===authority&&abilityStatsPending.revision===revision)return abilityStatsPending.promise;
  const request=++abilityStatsRequest,session=matrixSession,epoch=managementEpoch;
  if(force)abilityStatsSnapshot=null;abilityStatsError='';
  const current=()=>request===abilityStatsRequest&&session===matrixSession&&epoch===managementEpoch&&route==='statistics'&&managementAuthority(data)===authority&&abilityStatsRevision()===revision;
  const promise=(async()=>{try{const own=data.user.role!=='admin'?data.user.workshop_id:'',query=own?'?workshop_id='+encodeURIComponent(own):'',source=await practicalTimedRequest(signal=>api('/api/matrix'+query,{...(signal?{signal}:{})}));if(!current())return false;if(!Array.isArray(source?.rows)||!Array.isArray(source?.items))throw new Error('Invalid statistics');abilityStatsSnapshot={authority,revision,source,readAt:new Date().toISOString()};renderAbilityStatsContent();return true;}catch(error){if(current()){abilityStatsError=error.message||'load_failed';abilityStatsSnapshot=null;renderAbilityStatsContent();}return false;}finally{if(abilityStatsPending?.request===request){abilityStatsPending=null;const button=route==='statistics'&&$('[data-action="stats-refresh"]');if(button)button.disabled=false;}}})();
  abilityStatsPending={request,authority,revision,promise};renderAbilityStatsContent();return promise;
}
function changeAbilityStatsFilter(key,value){if(route!=='statistics'||!Object.hasOwn(abilityStatsFilters,key))return;if(key==='skill_category'&&!['all','operation','inspection','data'].includes(value))return;abilityStatsFilters[key]=value;if(key==='major_workshop_id'){abilityStatsFilters.workshop_id='';abilityStatsFilters.position_id='';}abilityStatsNormalize();renderAbilityStatsContent();}
function drillAbilityStats(key,value){if(!['major_workshop_id','workshop_id'].includes(key))return;changeAbilityStatsFilter(key,value);}

// Results have their own read-only source; fetching progress never changes a scoring workspace.
let resultsScoringCache=null,resultsScoringPending=null,resultsScoringError='',resultsScoringRequest=0;
function resultsScoringRevision(){return JSON.stringify([list('assignments').map(row=>[row.id,row.employee_id,row.status,row.percent,row.submitted_at,row.completed_at,row.graded_at,row.created_at,row.submission_review_required]),list('employees').map(row=>[row.id,row.workshop_id,row.position_id,row.active]),list('work_items').map(item=>[item.id,item.position_id,item.active,item.assessment_mode])]);}
function invalidateResultsScoringProgress(){resultsScoringRequest++;resultsScoringCache=null;resultsScoringPending=null;resultsScoringError='';}
function resultScoringProgress(row,revision=resultsScoringRevision()){
  if(row.status!=='completed'||row.submission_review_required||typeof row.percent!=='number'||!Number.isFinite(row.percent)||row.percent<0||row.percent>100)return {state:'theory_pending'};
  if(resultsScoringError)return {state:'error'};
  if(!resultsScoringCache||resultsScoringCache.authority!==managementAuthority(data)||resultsScoringCache.revision!==revision)return {state:'loading'};
  const employee=find('employees',row.employee_id),source=resultsScoringCache.source;
  const current=source.rows.find(value=>value.employee?.id===row.employee_id&&employee&&value.employee.workshop_id===employee.workshop_id&&value.employee.position_id===employee.position_id);
  if(!current)return {state:'unavailable'};
  if(current.latest_assignment_id!==row.id)return {state:'historical'};
  return {state:'ready',row:current,items:source.items,progress:employeeScoringProgress(current,source.items)};
}
function resultScoringProgressMarkup(row,revision){
  const status=resultScoringProgress(row,revision),labels=lang==='id'?{theory_pending:'Menunggu hasil teori',loading:'Memuat status penilaian…',error:'Gagal memuat · coba segarkan',unavailable:'Status penilaian tidak tersedia',historical:'Ujian terdahulu'}:{theory_pending:'理论未出分',loading:'正在读取评分状态…',error:'状态读取失败，请刷新',unavailable:'暂无评分数据',historical:'历史考试'};
  if(status.state==='ready')return `<div class="result-scoring-progress">${employeeScoringProgressMarkup(status.row,status.items)}</div>`;
  return `<div class="result-scoring-progress"><span class="employee-progress-badge is-unavailable">${esc(labels[status.state])}</span>${status.state==='historical'?`<small>${esc(lang==='id'?'Lihat penilaian pada ujian terakhir.':'当前实操进度见最新已出分考试。')}</small>`:''}</div>`;
}
function updateResultsScoringRefresh(){if(route!=='results')return;const button=$('[data-action="results-scoring-refresh"]');if(button)button.disabled=Boolean(resultsScoringPending);}
function renderResultsScoringTable(){if(route!=='results')return;const target=$('#table-content');if(target)target.innerHTML=tableBody(filteredRows());updateResultsScoringRefresh();}
async function loadResultsScoringProgress({force=false}={}){
  if(route!=='results'||!data.user||!permitted('view_results'))return false;
  const authority=managementAuthority(data),revision=resultsScoringRevision();
  if(!force&&resultsScoringCache?.authority===authority&&resultsScoringCache.revision===revision)return true;
  if(!force&&resultsScoringPending?.authority===authority&&resultsScoringPending.revision===revision)return resultsScoringPending.promise;
  const request=++resultsScoringRequest,session=matrixSession,epoch=managementEpoch;
  if(force)resultsScoringCache=null;resultsScoringError='';
  const current=()=>request===resultsScoringRequest&&session===matrixSession&&epoch===managementEpoch&&route==='results'&&managementAuthority(data)===authority&&resultsScoringRevision()===revision;
  const promise=(async()=>{
    try{
      const workshopId=data.user.role!=='admin'?data.user.workshop_id:'',query=workshopId?'?workshop_id='+encodeURIComponent(workshopId):'';
      const source=await practicalTimedRequest(signal=>api('/api/matrix'+query,{...(signal?{signal}:{})}));
      if(!current())return false;
      if(!Array.isArray(source?.rows)||!Array.isArray(source?.items))throw new Error('Invalid scoring data');
      resultsScoringCache={authority,revision,source};resultsScoringError='';renderResultsScoringTable();return true;
    }catch(error){if(current()){resultsScoringError=error.message||'load_failed';resultsScoringCache=null;renderResultsScoringTable();}return false;}
    finally{if(resultsScoringPending?.request===request){resultsScoringPending=null;updateResultsScoringRefresh();}}
  })();
  resultsScoringPending={request,authority,revision,promise};renderResultsScoringTable();return promise;
}
function resultsScoringChanged(){invalidateAbilityStats();invalidateResultsScoringProgress();if(route==='results'){renderResultsScoringTable();void loadResultsScoringProgress();}else if(route==='statistics'){renderAbilityStatsContent();void loadAbilityStats();}}
function filteredRows(){const c=cfg[route],questionChoice=route==='questions'&&(filters.question_bank_id||filters.work_item_id)?selectedQuestionWorkItemFilter():null,questionItemIds=route==='questions'&&filters.work_item_id?new Set(questionChoice?.item_ids||[]):null;const rows=list(c.collection).filter(row=>{if(route==='positions'&&!positionInUserScope(row)||route==='work_items'&&!positionInUserScope(find('positions',row.position_id))||route==='questions'&&hasQuestionBankCatalog()&&!bankInUserScope(bankOfQuestion(row)))return false;
  if(route==='questions'){
    if(!questionMatchesStatusFilter(row))return false;
    if(hasQuestionBankCatalog()){
      const bank=bankOfQuestion(row),own=data.user?.role!=='admin'&&data.user?.workshop_id?ownMajorId():'';
      if(own&&!questionMatchesMajor(row,own))return false;
      if(filters.major_workshop_id&&!questionMatchesMajor(row,filters.major_workshop_id))return false;
      if(filters.position_id&&!questionMatchesPosition(row,filters.position_id))return false;
      if((filters.question_bank_id||filters.work_item_id)&&(!questionChoice||String(bank?.id)!==questionChoice.value))return false;
      if(filters.search&&!JSON.stringify([row.title_zh,row.title_id,bank?.name,bank?.name_id,questionPositionLabels(row)]).toLowerCase().includes(filters.search.toLowerCase()))return false;
      return true;
    }
  }
  if(route==='results'&&filters.result_score==='below60'&&!isLowTheoryResult(row))return false;
  if(filters.search&&!JSON.stringify([row.name,row.code,row.title,row.title_zh,row.title_id,row.employee_no,row.username,nameOf('employees',row.employee_id)]).toLowerCase().includes(filters.search.toLowerCase()))return false;
  if(filters.workshop_id&&(route==='results'?resultWorkshopId(row):row.workshop_id)!==filters.workshop_id)return false;
  const positionId=route==='positions'?row.id:route==='questions'?positionOfQuestion(row):route==='results'?resultPositionId(row):row.position_id;
  if(filters.major_workshop_id){if(route==='company'){if(row.major_workshop_id!==filters.major_workshop_id)return false;}else if(!positionMatchesMajor(find('positions',positionId),filters.major_workshop_id))return false;}
  if(filters.position_id&&positionId!==filters.position_id)return false;
  return !filters.work_item_id||(route==='questions'?questionItemIds.has(String(row.work_item_id)):row.work_item_id===filters.work_item_id);
});return route==='questions'&&hasQuestionBankCatalog()?[...new Map(rows.map(row=>[row.id,row])).values()]:route==='results'?sortResultRows(rows):route==='employees'?sortEmployeeRows(rows):rows;}
function sharedWorkItemTable(rows){
  const groups=new Map();for(const item of rows){const bank=!isDirectAssessment(item)&&find('question_banks',item.question_bank_id);if(bank){const key='bank:'+bank.id;if(!groups.has(key))groups.set(key,{bank,items:[]});groups.get(key).items.push(item);}else groups.set('item:'+item.id,{items:[item]});}
  const markup=[...groups.values()].map(({bank,items})=>{
    if(!bank)return rowMarkup(items[0]);
    const activeItems=items.filter(item=>item.active!==false),positions=[...new Set(activeItems.map(item=>item.position_id))].map(id=>nameOf('positions',id)).join('、');
    const details=items.map(item=>`<div class="details-card"><strong>${esc(nameOf('positions',item.position_id))}</strong> · <span class="badge ${item.active!==false?'green':'gray'}">${esc(t(item.active!==false?'启用':'停用'))}</span><span class="cell-sub">${esc(t('作业类别'))}：${esc(skillCategoryLabel(item))}</span><span class="cell-sub">${esc(t('排序'))}：${esc(item.sort_order??0)}</span>${canEdit('work_items',item)?btn('edit','编辑',`data-collection="work_items" data-id="${esc(item.id)}"`,'link',''):''}${canDelete('work_items')?btn('delete','删除',`data-collection="work_items" data-id="${esc(item.id)}"`,'link',''):''}</div>`).join('');
    const cells=[`<span class="cell-main">${esc(bank.name)}</span>${bank.name_id?`<span class="cell-sub">${esc(bank.name_id)}</span>`:''}<span class="cell-sub">${esc(bank.workshop_id?nameOf('workshops',bank.workshop_id):majorName(bankMajorId(bank)))} · ${esc(t('共用题库'))}</span>`,esc(positions||t('当前题库没有启用的适用岗位。')),esc([...new Set(items.map(item=>skillCategoryLabel(item)))].join('、')),`<span class="badge">${esc(t('考试与实操'))}</span><span class="cell-sub">${esc(t('启用题目'))}：${esc(bank.active_question_count??list('questions').filter(q=>q.question_bank_id===bank.id&&!q.merged_into_question_id&&q.status==='active').length)}</span>`,'—',`<span class="badge ${activeItems.length?'green':'gray'}">${esc(t(activeItems.length?'启用':'停用'))}</span>`,`<details><summary>${esc(t('岗位配置'))} (${items.length})</summary>${details}</details>`];
    return `<tr data-question-bank="${esc(bank.id)}">${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr>${cfg.work_items.columns.map(label=>`<th>${esc(t(label==='所属岗位'?'适用岗位':label))}</th>`).join('')}<th>${esc(t('操作'))}</th></tr></thead><tbody>${markup}</tbody></table></div><div class="table-count">${groups.size} ${esc(t('条记录'))}</div>`;
}
function tableBody(rows){
  if(route==='work_items'&&hasQuestionBankCatalog()&&rows.length)return sharedWorkItemTable(rows);
  const c=cfg[route],revision=route==='results'?resultsScoringRevision():'';
  if(!rows.length){
    const total=list(c.collection).length,state=route==='questions'?questionSetupState():route==='work_items'&&!list('positions').some(positionInUserScope)?{route:'positions',message:'还没有岗位，请先添加本部门的岗位。',label:'添加岗位'}:null;
    let action='';
    if(state&&canAccessRoute(state.route))action=state.route==='questions'?btn('question-clear-filters',state.label,'','secondary',''):btn('navigate',state.label,`data-destination="${state.route}"`,'primary','');
    else if(!total&&canWrite(c.collection))action=route==='results'?btn('navigate','开放考试','data-destination="plans"'):btn('create','新增',`data-collection="${c.collection}"${route==='questions'&&questionPrerequisiteMissing()?' disabled':''}`);
    return `<div class="empty"><div class="empty-icon">${icon(route==='questions'?'book':route==='employees'?'users':route==='positions'?'briefcase':'grid')}</div><h3>${esc(t(total?'暂无符合条件的数据':c.empty))}</h3><p>${esc(t(state?.message||(total?'试着切换筛选条件或清空搜索。':c.hint)))}</p>${action}</div>`;
  }
  return `<div class="table-wrap"><table><thead><tr>${c.columns.map(x=>`<th>${esc(t(x))}</th>`).join('')}<th>${esc(t('操作'))}</th></tr></thead><tbody>${rows.map(row=>rowMarkup(row,revision)).join('')}</tbody></table></div><div class="table-count">${rows.length} ${esc(t('条记录'))}</div>`;
}
function rowMarkup(r,revision){let cells=[];const active=bool=>`<span class="badge ${bool?'green':'gray'}">${esc(t(bool?'启用':'停用'))}</span>`;switch(route){case'company':cells=[`<span class="cell-main">${esc(r.name)}</span>`,esc(r.major_workshop_id?majorName(r.major_workshop_id):t('演示车间')),esc(r.code||'—'),esc(r.manager||'—'),esc(r.description||'—')];break;case'positions':cells=[`<span class="cell-main">${esc(r.name)}</span>`,esc(positionMajorLabel(r)),esc(r.description||'—')];break;case'work_items':cells=[`<span class="cell-main">${esc(r.name)}</span>${r.name_id?`<span class="cell-sub">${esc(r.name_id)}</span>`:''}<span class="cell-sub">${esc(r.description||'')}</span>`,esc(nameOf('positions',r.position_id)),esc(skillCategoryLabel(r)),`<span class="badge ${isDirectAssessment(r)?'green':''}">${esc(t(isDirectAssessment(r)?'直接评分':'考试与实操'))}</span>`,esc(r.sort_order??0),active(r.active)];break;case'questions':cells=[`<span class="cell-main">${esc((lang==='id'?r.title_id:r.title_zh)||r.title_zh||r.title_id)}</span>`,`<span class="cell-main">${esc(hasQuestionBankCatalog()?(bankOfQuestion(r)?.name||nameOf('work_items',r.work_item_id)):nameOf('work_items',r.work_item_id))}</span><span class="cell-sub">${esc(hasQuestionBankCatalog()?questionPositionLabels(r):nameOf('positions',positionOfQuestion(r)))}</span>`,esc(dimensionLabel(r.dimension||'knowledge')),`<span class="badge">${esc(t(types[r.type]||r.type))}</span>`,esc(r.points),hasQuestionBankCatalog()&&r.merged_into_question_id?`<span class="badge gray">${esc(t('已归并，历史只读'))}</span>`:badge(r.status)];break;case'employees':cells=[`<span class="cell-main">${esc(r.name)}</span>`,esc(r.employee_no),esc(nameOf('workshops',r.workshop_id)),esc(nameOf('positions',r.position_id)),employeeCategoryCell(r),esc(t(r.language==='id'?'印尼文':'中文')),active(r.active)];break;case'plans':cells=[`<span class="cell-main">${esc(r.title)}</span>`,esc(nameOf('positions',r.position_id)),`${esc(planExamQuestionCount(r))}<span class="cell-sub">${esc(t('题量上限'))}: ${esc(r.question_count||50)}</span>`,`<span class="badge ${planAvailableQuestionCount(r)>0?'green':'orange'}">${planAvailableQuestionCount(r)}</span>`,esc(r.duration_minutes),badge(r.status)];break;case'results':{const emp=find('employees',r.employee_id);cells=[`<span class="cell-main">${esc(emp?.name||r.employee_name||'—')}</span><span class="cell-sub">${esc(emp?.employee_no||'')}</span>`,esc(find('plans',r.plan_id)?.title||r.plan_title||'—'),resultTheoryScoreMarkup(r),(r.submission_review_required?`<span class="badge orange">${esc(t('提交异常待复核'))}</span>`:badge(r.status))+(Number(r.screen_switch_count)>0?`<span class="cell-sub">${esc(t('已记录切屏次数'))}: ${esc(Number(r.screen_switch_count))} / 3</span>`:'')+(r.termination_reason==='screen_switch'?`<span class="cell-sub exam-termination-label">${esc(t('考试因切屏结束'))}</span>`:''),resultScoringProgressMarkup(r,revision),esc(formatDate(r.submitted_at))];break;}case'users':cells=[`<span class="cell-main">${esc(r.name||r.username)}</span>`,esc(r.username),esc(t(roles[r.role]||r.role)),esc(nameOf('workshops',r.workshop_id)),active(r.active)];}
let actions='';if(route==='results'){actions=btn('result-details','查看',`data-id="${esc(r.id)}"`,'link','');if(permitted('score_practical')&&r.status==='completed'&&r.percent!=null)actions+=btn('practical-assignment','现场实操',`data-id="${esc(r.id)}"`,'link','');if(permitted('manage_exams')&&r.token)actions+=btn('exam-link','考试链接',`data-id="${esc(r.id)}"`,'link','');if(canDeleteExamRecord(r))actions+=btn('delete-exam-record','删除',`data-id="${esc(r.id)}"`,'link','');}else{if(route==='plans'&&permitted('manage_exams'))actions+=btn('assign','分配考试',`data-plan="${esc(r.id)}"`,'link','');if(canEdit(cfg[route].collection,r)&&!(route==='questions'&&hasQuestionBankCatalog()&&r.merged_into_question_id))actions+=btn('edit','编辑',`data-collection="${cfg[route].collection}" data-id="${esc(r.id)}"`,'link','');if(canDelete(cfg[route].collection)&&!(route==='questions'&&hasQuestionBankCatalog()&&r.merged_into_question_id))actions+=btn('delete','删除',`data-collection="${cfg[route].collection}" data-id="${esc(r.id)}"`,'link','');if(route==='questions'&&(!canEdit('questions',r)||hasQuestionBankCatalog()&&r.merged_into_question_id))actions+=btn('view-question','查看',`data-id="${esc(r.id)}"`,'link','');}return `<tr${route==='results'&&isLowTheoryResult(r)?' class="result-low-row"':''}>${cells.map(cell=>`<td>${cell}</td>`).join('')}<td><div class="row-actions">${actions||'—'}</div></td></tr>`;}
function availableQuestions(positionId){return new Set(list('questions').filter(q=>q.status==='active'&&!q.merged_into_question_id&&['single','multiple','true_false'].includes(q.type)&&(hasQuestionBankCatalog()?questionMatchesPosition(q,positionId)&&questionItemIds(q).some(id=>{const item=find('work_items',id);return item?.position_id===positionId&&item.active!==false&&!isDirectAssessment(item);}):positionOfQuestion(q)===positionId&&find('work_items',q.work_item_id)?.active!==false&&!isDirectAssessment(find('work_items',q.work_item_id)))).map(question=>question.id)).size;}
function planAvailableQuestionCount(plan){return Number(plan.available_question_count??availableQuestions(plan.position_id));}
function planExamQuestionCount(plan){return Number(plan.exam_question_count??Math.min(Number(plan.question_count)||50,planAvailableQuestionCount(plan)));}
function formatScore(v){if(v===null||v===undefined)return '—';const number=Number(v);return Number.isFinite(number)?String(Number(number.toFixed(2))):'—';}
function formatDate(v){if(!v)return t('未提交');const date=new Date(v);if(isNaN(date.getTime()))return String(v);return new Intl.DateTimeFormat(lang==='id'?'id-ID':'zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);}
function assessmentCategories(){const rules=practicalData?.rating_rules||matrix?.rating_rules||data.rating_rules||{};return Array.isArray(rules.categories)?rules.categories.filter(category=>['leader','operator'].includes(category.key)):[];}
function assessmentCategoryKey(value){return typeof value==='string'?value:(value?.assessment_category||value?.employee?.assessment_category||'');}
function assessmentCategory(value){return assessmentCategories().find(category=>category.key===assessmentCategoryKey(value));}
function categoryLabel(value,bilingual=false){const category=assessmentCategory(value);if(!category)return bilingual?'待设置 / Belum ditetapkan':t('待设置');const zh=category.label_zh,id=category.label_id;if(bilingual)return `${zh} / ${id}`;return lang==='id'?(id||zh):zh;}
function categoryWeights(value){const category=assessmentCategory(value);if(!category)return null;const theory=Number(value?.theory_weight??category.theory_weight),practical=Number(value?.practical_weight??category.practical_weight);return Number.isFinite(theory)&&Number.isFinite(practical)?{theory,practical}:null;}
function weightsLabel(value){const weights=categoryWeights(value);return weights?`${t('项目理论')} ${formatScore(weights.theory*100)}% ＋ ${t('实操')} ${formatScore(weights.practical*100)}%`:t('待设置');}
function compositeFormula(value){const weights=categoryWeights(value);if(!weights)return t('请管理员在员工档案中设置人员类别，再进行现场实操评分。');return `${t('综合分')} = ${t('项目理论分')} × ${formatScore(weights.theory*100)}% + ${t('实操评分')} × 20 × ${formatScore(weights.practical*100)}%`;}
function categoryRuleCards(){return `<div class="category-rule-cards">${assessmentCategories().map(category=>`<div><strong>${esc(categoryLabel(category.key))}</strong><span>${esc(weightsLabel(category.key))}</span></div>`).join('')}</div>`;}
function employeeCategoryCell(employee){return `<span class="badge ${assessmentCategory(employee)?'':'orange'}">${esc(categoryLabel(employee))}</span><span class="cell-sub">${esc(weightsLabel(employee))}</span>`;}
function categorySelect(selected=''){return option('',t('请选择人员类别'),selected)+assessmentCategories().map(category=>option(category.key,categoryLabel(category.key,true),selected)).join('');}
function employeeAssessmentCategoryOptions(positionId,selected){const override=positionAssessmentCategoryOverride(positionId,list('positions'));return override?option(override,categoryLabel(override,true),override):categorySelect(selected);}
function employeeAssessmentCategoryHelp(positionId){return (positionAssessmentCategoryOverride(positionId,list('positions'))?forcedCategoryHelp():esc(t('人员类别由管理员设置。')))+`<br>${esc(t('修改人员类别后，已保存实操按新权重重新计算；原评分和历史记录保留。'))}`;}
function updateEmployeeAssessmentCategory(){const form=$('#editor-form'),select=form?.elements.assessment_category;if(!select)return;const positionId=form.elements.position_id?.value||'',selected=positionAssessmentCategory(positionId,select.value,list('positions'));select.innerHTML=employeeAssessmentCategoryOptions(positionId,selected);select.value=selected;const help=$('#employee-category-help');if(help)help.innerHTML=employeeAssessmentCategoryHelp(positionId);}
function ratingRulesPanel(open=false){
  const rules=data.rating_rules||matrix?.rating_rules||{};const bands=Array.isArray(rules.levels)?rules.levels:[];
  const table=bands.length?`<div class="table-wrap"><table class="rating-rule-table"><thead><tr><th>${esc(t('分数区间'))}</th><th>${esc(t('月亮等级'))}</th><th>${esc(t('通用矩阵等级定义'))}</th></tr></thead><tbody>${bands.map(b=>`<tr><td>${esc(`${b.min_percent} ≤ ${lang==='id'?'nilai':'得分'} ${Number(b.level)===4?'≤':'<'} ${b.max_percent}`)}</td><td>${moon(b.level)} <span>${esc(b.level)}</span></td><td>${esc(t(b.label||levels[b.level]||''))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="notice warning">${esc(lang==='id'?'Aturan penilaian belum dimuat.':'定级规则尚未加载。')}</div>`;
  return `<details class="rating-rules" ${open?'open':''}><summary><span>${esc(t('自动定级规则'))}</span><span class="muted">${esc(t('查看'))}</span></summary><div class="rating-rule-body">${directAssessmentNotice()}<p>${esc(t('仅考试作业使用人员类别权重；直接评分不参与加权。'))}<br>${esc(t('按人员类别设置理论与实操权重；类别待设置或实操未评分时不生成月亮。'))}</p><p>${esc(t('理论出分即可进行实操评分，不设最低分限制。'))}<br>${esc(t('综合分 = 项目理论分 × 理论权重 + 实操分 × 20 × 实操权重。'))}</p>${categoryRuleCards()}${table}<p class="security-note">${esc(t('综合等级反映本次理论与现场实操评价结果。'))}<br>${esc(t('未安排或未覆盖的项目保持空白；理论未出分或实操未评时不生成等级。'))}<br>${esc(t('人员类别由管理员按评估规则设置。'))}<br>${esc(t('修改人员类别后，已保存实操按新权重重新计算；原评分和历史记录保留。'))}</p></div></details>`;
}
// Read-only development candidates. Search/reason filters never change peer cohorts.
let developmentFilters={workshop_id:'',position_id:'',skill_category:'all',only:'all',search:''};
let developmentSnapshot=null,developmentPending=null,developmentError='',developmentRequest=0;
const developmentText=(zh,id)=>lang==='id'?id:zh;
function invalidateDevelopment(reset=false){developmentRequest++;developmentSnapshot=null;developmentPending=null;developmentError='';if(reset)developmentFilters={workshop_id:'',position_id:'',skill_category:'all',only:'all',search:''};}
function developmentNormalize(){const workshops=abilityStatsWorkshops(),scope=developmentFilters,own=data.user?.role!=='admin'?data.user?.workshop_id:'';if(own)scope.workshop_id=own;else if(scope.workshop_id&&!workshops.some(w=>w.id===scope.workshop_id))scope.workshop_id='';if(scope.position_id&&!list('positions').some(p=>p.id===scope.position_id&&workshops.some(w=>(!scope.workshop_id||scope.workshop_id===w.id)&&positionMatchesWorkshop(p,w.id,workshops))))scope.position_id='';}
function developmentScopeKey(){return JSON.stringify([developmentFilters.workshop_id,developmentFilters.position_id,developmentFilters.skill_category]);}
function developmentToolbar(){developmentNormalize();const s=developmentFilters,workshops=abilityStatsWorkshops(),field=(label,key,options)=>`<label class="field"><span>${esc(label)}</span><select data-development-filter="${key}">${options}</select></label>`;return `<section class="panel development-toolbar">${field(t('编号车间'),'workshop_id',option('',t('全部车间'),s.workshop_id)+workshops.map(w=>option(w.id,lang==='id'?(w.name_id||w.name):w.name,s.workshop_id)).join(''))}${field(t('所属岗位'),'position_id',option('',t('全部岗位'),s.position_id)+list('positions').filter(p=>workshops.some(w=>(!s.workshop_id||s.workshop_id===w.id)&&positionMatchesWorkshop(p,w.id,workshops))).map(p=>option(p.id,lang==='id'?(p.name_id||p.name):p.name,s.position_id)).join(''))}${field(developmentText('技能范围','Jenis keterampilan'),'skill_category',[['all','全部技能','Semua'],['operation','标准作业','Standar'],['inspection','点检','Inspeksi'],['data','数据','Data']].map(([k,zh,id])=>option(k,developmentText(zh,id),s.skill_category)).join(''))}${field(developmentText('培养原因','Alasan pengembangan'),'only',[['all','全部培养项','Semua kebutuhan'],['below_average','低于同组均值','Di bawah rata-rata'],['priority','重点培养','Prioritas'],['sample_insufficient','比较样本不足','Sampel tidak cukup']].map(([k,zh,id])=>option(k,developmentText(zh,id),s.only)).join(''))}<label class="field development-search"><span>${esc(developmentText('查找员工或技能','Cari karyawan atau keterampilan'))}</span><input type="search" data-development-search value="${esc(s.search)}" placeholder="${esc(t('搜索名称、编号或题目'))}"></label></section>`;}
function developmentPage(){return pageHeading('能力培养',developmentText('按同车间、同岗位、同能力项目，识别需要专项培养的员工。','Identifikasi kebutuhan pengembangan pada unit, jabatan dan keterampilan yang sama.'),btn('development-export',developmentText('导出培养清单','Ekspor daftar'),'','secondary','download')+btn('development-refresh',developmentText('刷新清单','Segarkan'),'','secondary',''))+`<div class="notice">${esc(developmentText('低于同组均值与尚不可独立完成分别标明。仅使用有效、已保存的评定；没有评分不视为能力差。','Di bawah rata-rata dan belum mandiri ditandai terpisah. Hanya penilaian sah tersimpan digunakan; belum dinilai bukan berarti kurang mampu.'))}</div><div id="development-controls">${developmentToolbar()}</div><div id="development-content">${abilityStatsLoading()}</div>`;}
function developmentRows(){if(!developmentSnapshot||developmentSnapshot.authority!==managementAuthority(data)||developmentSnapshot.revision!==abilityStatsRevision())return [];const s=developmentFilters,q=s.search.trim().toLocaleLowerCase();return (developmentSnapshot.source.rows||[]).filter(r=>(s.only==='all'||r[s.only]===true)&&(!q||[r.employee?.name,r.employee?.employee_no,r.work_item?.name,r.work_item?.name_id,r.workshop?.name,r.position?.name].some(v=>String(v||'').toLocaleLowerCase().includes(q))));}
function developmentValue(value,unit){return typeof value==='number'&&Number.isFinite(value)?`${formatScore(Number(value.toFixed(2)))}${unit==='percent'?'%':developmentText(' 分',' poin')}`:'—';}
function developmentFlags(r){return `${r.below_average?`<span class="badge orange">${esc(developmentText('低于同组均值','Di bawah rata-rata'))}</span>`:''}${r.priority?`<span class="badge red">${esc(developmentText('重点培养：尚不可独立完成','Prioritas: belum mandiri'))}</span>`:''}${r.sample_insufficient?`<span class="badge">${esc(developmentText('比较样本不足','Sampel tidak cukup'))}</span>`:''}`;}
function developmentEvidence(r){const e=r.evidence||{},c=r.criteria||{},direct=r.unit==='score',pairs=direct?[[developmentText('已保存直接评分','Nilai langsung tersimpan'),developmentValue(e.direct_score??e.practical_score,'score')]]:[[developmentText('项目理论成绩','Nilai teori keterampilan'),developmentValue(e.theory_item_percent,'percent')],[developmentText('实操评分','Nilai praktik'),developmentValue(e.practical_score,'score')],[developmentText('该项目试题数','Jumlah soal keterampilan'),e.question_count??'—'],[developmentText('理论 / 实操权重','Bobot teori / praktik'),`${developmentValue(typeof c.theory_weight==='number'?c.theory_weight*100:null,'percent')} / ${developmentValue(typeof c.practical_weight==='number'?c.practical_weight*100:null,'percent')}`]];if(!direct)pairs.push([developmentText('人员类别','Kategori karyawan'),lang==='id'?(assessmentCategory(c.assessment_category)?.label_id||c.assessment_category||'—'):(assessmentCategory(c.assessment_category)?.label_zh||c.assessment_category||'—')]);pairs.push([developmentText('评分时间','Waktu penilaian'),formatDate(e.rated_at||e.practical_reviewed_at)],[developmentText('规则版本','Versi aturan'),e.rule_version||c.rule_version||'—']);return `<details class="development-evidence"><summary>${esc(developmentText('查看评分依据','Lihat dasar penilaian'))}</summary><dl>${pairs.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>`;}
function renderDevelopmentContent(){if(route!=='development')return;const target=$('#development-content');if(!target)return;const controls=$('#development-controls');if(controls)controls.innerHTML=developmentToolbar();const button=$('[data-action="development-refresh"]');if(button)button.disabled=Boolean(developmentPending);if(developmentError){target.innerHTML=`<section class="panel"><div class="empty"><h3>${esc(developmentText('培养清单读取失败','Daftar gagal dimuat'))}</h3><p>${esc(developmentText('请刷新清单重试。','Segarkan untuk mencoba lagi.'))}</p></div></section>`;return;}if(!developmentSnapshot||developmentSnapshot.authority!==managementAuthority(data)||developmentSnapshot.revision!==abilityStatsRevision()){target.innerHTML=abilityStatsLoading();return;}const rows=developmentRows(),source=developmentSnapshot.source,n=new Set(rows.map(r=>r.employee.id)).size,counts=source.counts||{};const metrics=[[developmentText('当前清单员工','Karyawan dalam daftar'),n],[developmentText('需培养技能项','Kebutuhan keterampilan'),rows.length],[developmentText('低于同组均值','Di bawah rata-rata'),rows.filter(r=>r.below_average).length],[developmentText('重点培养项','Item prioritas'),rows.filter(r=>r.priority).length]];target.innerHTML=`<section class="panel development-summary"><dl>${metrics.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl><p>${esc(developmentText('当前范围已有有效评定：','Penilaian sah dalam cakupan: '))}${Number(counts.assessed_employees||0)} ${esc(t('人'))} · ${Number(counts.valid_assessments||0)} ${esc(t('项'))}<span>${esc(developmentText('读取于 ','Dibaca pada '))}${esc(formatDate(source.generated_at||developmentSnapshot.readAt))}</span></p></section><section class="panel"><p class="development-scroll-hint">${esc(developmentText('左右滑动查看同组均值和评分依据。','Geser ke samping untuk melihat rata-rata dan dasar penilaian.'))}</p><div class="table-wrap"><table class="development-table"><thead><tr>${['员工','车间 / 岗位','能力项目','本人结果','同组比较','培养原因 / 依据'].map((zh,i)=>`<th>${esc(developmentText(zh,['Karyawan','Unit / Jabatan','Keterampilan','Hasil pribadi','Perbandingan','Alasan / Dasar'][i]))}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><strong>${esc(r.employee.name)}</strong><small>${esc(r.employee.employee_no)}</small></td><td>${esc(lang==='id'?(r.workshop.name_id||r.workshop.name):r.workshop.name)}<small>${esc(lang==='id'?(r.position.name_id||r.position.name):r.position.name)}</small></td><td><strong>${esc(lang==='id'?(r.work_item.name_id||r.work_item.name):r.work_item.name)}</strong><small>${esc(skillCategoryLabel(r.work_item))} · ${esc(t(r.unit==='score'?'直接评分':'考试与实操'))}</small></td><td><strong>${esc(developmentValue(r.value,r.unit))}</strong><small>${esc(t(levels[r.level]||'—'))}</small></td><td><strong>${esc(developmentValue(r.peer_average,r.unit))}</strong><small>${esc(developmentText('其他可比员工','Karyawan pembanding lain'))} ${Number(r.compare_count||0)} ${esc(t('人'))} · ${esc(developmentText('不含本人','tanpa diri sendiri'))}</small>${r.gap!=null?`<small>${esc(developmentText('差距（本人－均值）','Selisih pribadi − rata-rata'))} ${esc(Math.abs(r.gap)>0&&Math.abs(r.gap)<0.01?(r.gap<0?'-<0.01':'+<0.01'):developmentValue(r.gap,r.unit))}</small>`:''}</td><td><div class="development-flags">${developmentFlags(r)}</div>${developmentEvidence(r)}</td></tr>`).join(''):`<tr><td colspan="6"><div class="empty"><h3>${esc(developmentText('当前筛选下暂无培养项','Tidak ada kebutuhan pada filter ini'))}</h3><p>${esc(developmentText('这不代表所有员工均已评定；可查看上方有效评定人数和项目数。','Ini tidak berarti semua karyawan sudah dinilai. Lihat jumlah penilaian sah di atas.'))}</p></div></td></tr>`}</tbody></table></div></section><details class="panel development-definitions" open><summary>${esc(developmentText('比较口径与数据范围','Dasar perbandingan dan cakupan'))}</summary><div><p>${esc(developmentText('同车间、同岗位、同一能力项目分别比较。标准作业还要求人员类别、理论实操权重、评分规则版本一致。本人不参与自己的均值计算；至少共3名可比员工（另2人）才判定低于均值。','Bandingkan unit, jabatan dan keterampilan yang sama. Pekerjaan standar juga memerlukan kategori karyawan, bobot dan versi aturan yang sama. Diri sendiri dikecualikan; minimal 3 karyawan (2 orang lain) diperlukan.'))}</p><p>${esc(developmentText('标准作业比较已保存的理论与实操综合分（百分制）；点检、数据比较直接评分（1～5分）。等级低于“可独立完成”单列为重点培养；样本不足时不显示均值、不判定低于平均。搜索与培养原因筛选只缩小清单，不改变比较人群。','Pekerjaan standar memakai nilai gabungan 0–100%; inspeksi dan data memakai skor langsung 1–5. Tingkat di bawah mandiri menjadi prioritas. Sampel kurang tidak dinilai di bawah rata-rata. Pencarian tidak mengubah kelompok pembanding.'))}</p><p>${esc(developmentText('仅使用在用员工当前适用项目的有效已保存结果，不合并历史考试；未评分、无效结果、身份存在冲突的档案不进入比较。清单用于安排培养，不会自动修改成绩或评分。','Hanya hasil sah tersimpan untuk karyawan aktif dan keterampilan saat ini. Riwayat ujian tidak digabung; hasil tidak sah, belum dinilai dan identitas konflik dikecualikan. Daftar tidak mengubah hasil penilaian.'))}</p>${Object.entries(source.exclusions||{}).some(([,v])=>Number(v)>0)?`<p>${esc(developmentText('数据排除项（可展开核查）','Data yang dikecualikan'))}</p><details><summary>${esc(developmentText('查看排除数量','Lihat jumlah pengecualian'))}</summary><ul>${Object.entries(source.exclusions||{}).filter(([,v])=>Number(v)>0).map(([k,v])=>`<li>${esc(developmentExclusionLabel(k))}：${Number(v)}</li>`).join('')}</ul></details>`:''}</div></details>`;}
function developmentExclusionLabel(k){const labels={invalid_employee_relation:'员工车间或岗位关系无效',missing_employee_identity:'姓名或工号缺失',invalid_item:'能力项目无效',invalid_item_relation:'能力项目与岗位关系不一致',inactive_item:'停用能力项目',invalid_item_classification:'能力项目评分分类无效',duplicate_item_rows:'重复项目行',conflicting_item_rows:'项目数据冲突',invalid_matrix_row:'员工矩阵记录无效',duplicate_employee_rows:'重复员工记录',invalid_matrix_employee_relation:'矩阵与员工档案不一致',duplicate_cell_rows:'重复评分记录',conflicting_cell_rows:'评分记录冲突',incomplete_theory_evidence:'理论成绩依据不完整',inconsistent_composite:'综合分与计算规则不一致',missing_assessment:'尚无评分',inactive_employee:'停用员工',ambiguous_identity_groups:'姓名与工号重复的档案组',ambiguous_identity_profiles:'姓名与工号重复的档案',unassessed_or_invalid_level:'未评定或等级无效',unassessed_or_invalid_score:'未评定或评分无效',incomplete_or_conflicting_mode:'评定未完成或方式不一致',missing_or_conflicting_rules:'评分规则缺失或不一致',outdated_assignment:'非当前有效考试',invalid_direct_evidence:'直接评分依据无效',invalid_evidence:'评分依据无效'};return lang==='zh'?(labels[k]||k):k.replaceAll('_',' ');}
async function loadDevelopment({force=false}={}){if(route!=='development'||!data.user||!canAccessRoute('development'))return false;developmentNormalize();const authority=managementAuthority(data),revision=abilityStatsRevision(),scope=developmentScopeKey();if(!force&&developmentSnapshot?.authority===authority&&developmentSnapshot.revision===revision&&developmentSnapshot.scope===scope){renderDevelopmentContent();return true;}if(!force&&developmentPending?.authority===authority&&developmentPending.revision===revision&&developmentPending.scope===scope)return developmentPending.promise;const request=++developmentRequest,session=matrixSession,epoch=managementEpoch;developmentSnapshot=null;developmentError='';const current=()=>request===developmentRequest&&session===matrixSession&&epoch===managementEpoch&&route==='development'&&managementAuthority(data)===authority&&abilityStatsRevision()===revision&&developmentScopeKey()===scope;const promise=(async()=>{try{const query=new URLSearchParams();for(const k of ['workshop_id','position_id','skill_category'])if(developmentFilters[k]&&developmentFilters[k]!=='all')query.set(k,developmentFilters[k]);const source=await practicalTimedRequest(signal=>api('/api/development'+(query.size?'?'+query:''),{...(signal?{signal}:{})}));if(!current())return false;if(source?.source!=='capability_development'||!Array.isArray(source.rows))throw Error('Invalid development report');developmentSnapshot={source,authority,revision,scope,readAt:new Date().toISOString()};return true;}catch(e){if(current()){developmentError=e.message||'load_failed';developmentSnapshot=null;}return false;}finally{if(developmentPending?.request===request)developmentPending=null;if(current())renderDevelopmentContent();}})();developmentPending={request,authority,revision,scope,promise};renderDevelopmentContent();return promise;}
function changeDevelopmentFilter(key,value){if(route!=='development'||!Object.hasOwn(developmentFilters,key))return;if(key==='only'&&!['all','below_average','priority','sample_insufficient'].includes(value)||key==='skill_category'&&!['all','operation','inspection','data'].includes(value)||key==='workshop_id'&&value&&!abilityStatsWorkshops().some(w=>w.id===value))return;developmentFilters[key]=value;developmentNormalize();if(['only','search'].includes(key)){renderDevelopmentContent();return;}invalidateDevelopment();renderDevelopmentContent();void loadDevelopment();}
function developmentCSV(rows=developmentRows()){const text=(value,force=false)=>{let s=String(value??'');if(force||/^[\s\uFEFF]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const headers=['姓名','工号','车间','岗位','能力项目','作业类别','统计归属','评分方式','本人结果','单位','能力等级','其他可比人数（不含本人）','同组均值','本人减均值','低于均值','重点培养','样本不足','项目理论分','实操或直接评分','理论权重','实操权重','项目题数','评分时间','规则版本','数据读取时间'];return '\uFEFF'+[headers.map(v=>text(v)).join(','),...rows.map(r=>[r.employee.name,text(r.employee.employee_no,true),r.workshop.name,r.position.name,r.work_item.name,skillCategoryLabel(r.work_item),t({operation:'标准作业',inspection:'点检',data:'数据'}[skillCategory(r.work_item)]),r.unit==='score'?'直接评分':'考试与实操',r.value,r.unit==='percent'?'%':'1～5分',t(levels[r.level]),r.compare_count,r.peer_average,r.gap,r.below_average?'是':'否',r.priority?'是':'否',r.sample_insufficient?'是':'否',r.evidence?.theory_item_percent,r.evidence?.direct_score??r.evidence?.practical_score,r.criteria?.theory_weight,r.criteria?.practical_weight,r.evidence?.question_count,r.evidence?.rated_at||r.evidence?.practical_reviewed_at,r.evidence?.rule_version,developmentSnapshot?.source?.generated_at].map((v,i)=>i===1?v:text(v)).join(','))].join('\r\n');}
function exportDevelopment(){const rows=developmentRows();if(!rows.length){toast(developmentText('当前没有可导出的培养项','Tidak ada item untuk diekspor'));return;}const blob=new Blob([developmentCSV(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='能力培养清单.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}

// Explicit administrator review. Rendering and previewing never delete records.
let examCleanupSnapshot=null,examCleanupPending=null,examCleanupError='',examCleanupRequest=0;
function canManageExamCleanup(){return data.user?.role==='admin'&&permitted('manage_exams');}
function invalidateExamCleanup(){examCleanupRequest++;examCleanupSnapshot=null;examCleanupPending=null;examCleanupError='';}
function examCleanupContext(){return {authority:managementAuthority(data),epoch:managementEpoch,session:matrixSession};}
function examCleanupCurrent(context){return canManageExamCleanup()&&route==='settings'&&context.authority===managementAuthority(data)&&context.epoch===managementEpoch&&context.session===matrixSession;}
function examCleanupPanel(){if(!canManageExamCleanup())return '';return `<section class="panel exam-cleanup-panel"><div class="panel-header"><div><h2>${esc(developmentText('重复考试记录清理','Pembersihan catatan ujian duplikat'))}</h2><p>${esc(developmentText('仅系统管理员可操作；每次清理前检测并确认。','Hanya administrator; periksa dan konfirmasi sebelum setiap pembersihan.'))}</p></div>${btn('exam-cleanup-refresh',developmentText('重新检测','Periksa ulang'),'','secondary','')}</div><div class="panel-body"><p>${esc(developmentText('识别规则：同姓名、同工号、同一考试轮次。保留有效记录，只清理多余且未开始的记录。工号前缀和前导零不会被删除；不同车间或岗位的冲突记录只列出供核查。','Aturan: nama, nomor karyawan, dan putaran ujian yang sama. Pertahankan catatan sah; hapus hanya duplikat yang belum dimulai. Awalan dan nol nomor tetap dipertahankan; konflik unit atau jabatan hanya ditandai.'))}</p><div id="exam-cleanup-content">${abilityStatsLoading()}</div></div></section>`;}
function renderExamCleanupContent(){if(route!=='settings'||!canManageExamCleanup())return;const target=$('#exam-cleanup-content');if(!target)return;const button=$('[data-action="exam-cleanup-refresh"]');if(button)button.disabled=Boolean(examCleanupPending);if(examCleanupError){target.innerHTML=`<div class="notice">${esc(developmentText('检测失败，请重新检测。','Pemeriksaan gagal. Coba lagi.'))}</div>`;return;}if(!examCleanupSnapshot||!examCleanupCurrent(examCleanupSnapshot)){target.innerHTML=abilityStatsLoading();return;}const s=examCleanupSnapshot.source,summary=s.summary||{};target.innerHTML=`<div class="exam-cleanup-controls"><span class="badge ${s.settings.enabled?'green':''}">${esc(developmentText(s.settings.enabled?'清理规则已启用':'清理规则未启用',s.settings.enabled?'Aturan aktif':'Aturan nonaktif'))}</span>${btn('exam-cleanup-settings',developmentText('设置清理规则','Atur pembersihan'),'','secondary','')}${btn('exam-cleanup-apply',s.settings.enabled?developmentText('核对并清理','Tinjau dan bersihkan'):developmentText('启用并清理','Aktifkan dan bersihkan'),'','primary','')}</div><p class="security-note">${esc(developmentText('启用后仍须手动确认每次清理，不会后台自动删除。已作答、已评分记录不会被删除，也不会重置本轮考试资格。','Aturan tetap memerlukan konfirmasi manual setiap kali. Tidak ada penghapusan otomatis, nilai tidak dihapus, dan kuota ujian tidak direset.'))}</p><div class="exam-cleanup-counts">${Number(summary.duplicate_groups||0)} ${esc(developmentText('组重复','kelompok duplikat'))} · ${Number(summary.eligible_records||0)} ${esc(developmentText('条可清理','dapat dibersihkan'))} · ${Number(summary.review_groups||0)} ${esc(developmentText('组需人工核查','perlu ditinjau'))}</div>${examCleanupGroups(s)}`;}
function examCleanupGroups(source,onlyEligible=false){const groups=(source.groups||[]).filter(g=>!onlyEligible||g.eligible_ids.length);return groups.length?`<div class="exam-cleanup-groups">${groups.map(g=>`<section class="exam-cleanup-group"><h3>${esc(g.employee_name)} · ${esc(g.employee_no)}</h3><p>${esc(g.round_title||g.round_id)} · ${esc(nameOf('workshops',g.workshop_id))} / ${esc(nameOf('positions',g.position_id))}</p>${g.conflicts?.length?`<p class="form-error">${esc(developmentText('身份或范围冲突，仅供核查。','Konflik identitas atau cakupan; tinjau saja.'))}</p>`:''}<ul>${g.records.map(r=>`<li><code>${esc(r.id)}</code> <span>${esc(t(statuses[r.status]||r.status))}</span> <strong>${esc(r.action==='delete'?developmentText('将清理','Akan dihapus'):r.id===g.keeper_id?developmentText('保留','Pertahankan'):developmentText('保留，人工核查','Pertahankan, tinjau'))}</strong>${r.protected_reasons?.length?`<small>${esc(developmentText('有考试或评分痕迹，受保护','Ada aktivitas ujian atau penilaian; dilindungi'))}</small>`:''}</li>`).join('')}</ul></section>`).join('')}</div>`:`<p class="empty">${esc(developmentText('没有符合本规则的重复记录。','Tidak ada duplikat yang memenuhi aturan.'))}</p>`;}
async function loadExamCleanup({force=false}={}){if(!canManageExamCleanup()||route!=='settings')return false;const context=examCleanupContext();if(!force&&examCleanupSnapshot&&examCleanupCurrent(examCleanupSnapshot)){renderExamCleanupContent();return true;}if(!force&&examCleanupPending&&examCleanupCurrent(examCleanupPending))return examCleanupPending.promise;const request=++examCleanupRequest;examCleanupSnapshot=null;examCleanupError='';const current=()=>request===examCleanupRequest&&examCleanupCurrent(context);const promise=(async()=>{try{const source=await practicalTimedRequest(signal=>api('/api/exam-record-cleanup',{...(signal?{signal}:{})}));if(!current())return false;if(!source?.version||!source.settings||!Array.isArray(source.groups))throw Error('Invalid cleanup preview');examCleanupSnapshot={source,...context};return true;}catch(e){if(current())examCleanupError=e.message||'load_failed';return false;}finally{if(examCleanupPending?.request===request)examCleanupPending=null;if(current())renderExamCleanupContent();}})();examCleanupPending={request,...context,promise};renderExamCleanupContent();return promise;}
function examCleanupDialogCurrent(context,submit,version){return examCleanupCurrent(context)&&examCleanupSnapshot?.source?.version===version&&editorSubmit===submit&&$('#editor')?.open;}
function openExamCleanupSettings(){if(!canManageExamCleanup()||!examCleanupSnapshot||!examCleanupCurrent(examCleanupSnapshot))return;const context=examCleanupContext(),source=examCleanupSnapshot.source;const submit=async form=>{if(!examCleanupDialogCurrent(context,submit,source.version))return;const enabled=form.elements.enabled?.checked===true;await practicalTimedRequest(signal=>api('/api/exam-record-cleanup/settings',{method:'PUT',body:{enabled,expected_version:source.version},...(signal?{signal}:{})}));if(!examCleanupDialogCurrent(context,submit,source.version))return;closeEditor();invalidateExamCleanup();await loadExamCleanup();toast(t('保存成功'));};openEditor(developmentText('重复记录清理设置','Aturan pembersihan'),developmentText('保存设置不会删除任何记录；清理时仍需核对具体记录。','Menyimpan aturan tidak menghapus catatan. Konfirmasi tetap diperlukan.'),checkbox('enabled',developmentText('启用重复记录清理规则','Aktifkan aturan pembersihan'),source.settings.enabled),submit);}
function openExamCleanupApply(){if(!canManageExamCleanup()||!examCleanupSnapshot||!examCleanupCurrent(examCleanupSnapshot))return;const source=examCleanupSnapshot.source,context=examCleanupContext();if(!source.summary?.eligible_records){toast(developmentText('当前没有可安全清理的重复记录','Tidak ada duplikat yang aman dibersihkan'));return;}const key=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');const submit=async form=>{if(!examCleanupDialogCurrent(context,submit,source.version))return;if(form.elements.confirm_exam_cleanup?.checked!==true)throw Error(developmentText('请先勾选确认清理范围。','Konfirmasi cakupan pembersihan.'));const result=await practicalTimedRequest(signal=>api('/api/exam-record-cleanup/apply',{method:'POST',body:{expected_version:source.version,enabled:true,request_key:key},...(signal?{signal}:{})}));if(!examCleanupDialogCurrent(context,submit,source.version))return;closeEditor();invalidateExamCleanup();invalidateResultsScoringProgress();invalidateAbilityStats();await refresh({background:true});if(examCleanupCurrent(context))await loadExamCleanup();toast(developmentText(`已清理 ${Number(result.deleted_count||0)} 条未开始的重复记录`,`Dibersihkan ${Number(result.deleted_count||0)} duplikat yang belum dimulai`));};openEditor(developmentText('核对重复记录清理','Tinjau pembersihan'),developmentText('仅清理下面标明的多余未开始记录。已作答和评分受保护；操作会保存原记录备份。','Hanya duplikat belum dimulai yang ditandai di bawah dihapus. Aktivitas dan nilai dilindungi; catatan asli diarsipkan.'),examCleanupGroups(source,true)+checkbox('confirm_exam_cleanup',developmentText('我已核对保留项与清理项，确认执行','Saya sudah meninjau catatan yang dipertahankan dan dihapus'),false).replace('type="checkbox"','type="checkbox" required'),submit,developmentText('确认清理','Konfirmasi'));}

function settingsPage(){
  return pageHeading('系统设置','通用演示评分规则，可按实际评估要求配置。')+`<section class="panel"><div class="panel-header"><h2>${esc(t('能力矩阵导出'))}</h2></div><div class="panel-body"><p>${esc(t('导出文件根据当前选择的数据由代码生成。'))}</p><p>${esc(t('演示数据仅用于体验流程，不代表真实人员评估结果。'))}</p></div></section>${ratingRulesPanel(false)}${examCleanupPanel()}`;
}
function gotoPractical(assignment=null){
  if(!canAccessRoute('practical'))return;captureMatrixDrafts();const employee=assignment?find('employees',assignment.employee_id):null;
  const workshopId=employee?.workshop_id||data.user?.workshop_id||filters.workshop_id||$('#workshop-export-select')?.value||'';
  const positionId=employee?.position_id||(assignment?find('plans',assignment.plan_id)?.position_id:'')||filters.position_id||'';
  route='practical';filters={workshop_id:workshopId,position_id:positionId,employee_id:employee?.id||assignment?.employee_id||''};practicalData=null;practicalScope='';history.pushState({},'','/practical');render();
}
function practicalPage(){
  if(!filters.workshop_id&&data.user?.workshop_id)filters.workshop_id=data.user.workshop_id;
  if(filters.position_id&&!positionMatchesWorkshop(find('positions',filters.position_id),filters.workshop_id))filters.position_id='';
  ensureMatrixScoringScope();
  return pageHeading('现场实操评分','支持单人或多人分别评分；点检和数据技能无需考试。')+directAssessmentNotice()+`<details class="practical-exam-rules"><summary>${esc(t('考试与实操'))} · ${esc(t('评分参考'))}</summary>${categoryRuleCards()}<div class="notice">${esc(t('每人每项作业按 1～5 分评分：1 分最低，5 分最高；实操百分制分数 = 所选分数 × 20。'))}<br>${esc(t('综合分 = 项目理论分 × 理论权重 + 实操分 × 20 × 实操权重。'))}<br>${esc(t('重考后，现场实操需要按新的考试重新评分。'))}</div></details><section class="panel practical-scoring-panel"><div class="table-toolbar practical-selectors"><label class="field"><span>${esc(t('编号车间'))}</span><select data-filter="practical_workshop" ${data.user?.workshop_id&&data.user.role!=='admin'?'disabled':''}>${selectOptions('workshops',filters.workshop_id,'请选择')}</select></label><label class="field"><span>${esc(t('所属岗位'))}</span><select data-filter="practical_position" ${filters.workshop_id?'':'disabled'}>${positionOptions(filters.position_id,'请选择',position=>positionMatchesWorkshop(position,filters.workshop_id))}</select></label></div><div id="matrix-scoring-controls">${matrixScoringControls()}</div><div id="practical-content">${practicalEmpty('选择车间和岗位后，再选择员工进行评分。')}</div></section>`;
}
function employeeScoringProgress(row,items=[]){
  const employee=row?.employee||{},seen=new Set(),applicable=(Array.isArray(items)?items:[]).filter(item=>{
    if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id)||item.active!==true||item.position_id&&employee.position_id&&item.position_id!==employee.position_id)return false;
    seen.add(item.id);return true;
  });
  const validPercent=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
  const savedScore=value=>Number.isInteger(value)&&value>=1&&value<=5;
  const cells=Array.isArray(row?.cells)?row.cells:[],latest=typeof row?.latest_assignment_id==='string'?row.latest_assignment_id:'';
  let practicalTotal=0,practicalSaved=0,directTotal=0,directSaved=0,examItemCount=0;
  for(const item of applicable){
    const cell=cells.find(value=>value.work_item_id===item.id);
    if(isDirectAssessment(item)){directTotal++;if(savedScore(cell?.practical_score))directSaved++;continue;}
    examItemCount++;
    if(!cell||!latest||cell.assignment_id!==latest||!validPercent(cell.theory_exam_percent)||!validPercent(cell.theory_item_percent??cell.knowledge_percent)||!Number.isInteger(cell.question_count)||cell.question_count<=0)continue;
    practicalTotal++;if(savedScore(cell.practical_score))practicalSaved++;
  }
  const progress=(saved,total)=>({saved,total,state:!total?'unavailable':saved===total?'complete':saved?'partial':'pending'});
  return {practical:progress(practicalSaved,practicalTotal),direct:progress(directSaved,directTotal),uncovered:examItemCount-practicalTotal,examItemCount,inactive:employee.active===false};
}
function employeeScoringProgressParts(progress){
  if(progress.inactive)return [{state:'unavailable',text:lang==='id'?'Karyawan nonaktif':'员工已停用'}];
  const parts=[],p=progress.practical,d=progress.direct;
  if(progress.examItemCount){
    const text=lang==='id'?{complete:'Penilaian praktik selesai',partial:'Penilaian praktik sebagian',pending:'Menunggu penilaian praktik',unavailable:'Belum ada praktik yang dapat dinilai'}:{complete:'已完成实操评分',partial:'实操评分中',pending:'待实操评分',unavailable:'暂无可评实操'};
    parts.push({state:p.state,text:text[p.state]+(p.total?` ${p.saved}/${p.total}`:'')});
  }
  if(d.total){
    const text=lang==='id'?{complete:'Penilaian langsung selesai',partial:'Penilaian langsung sebagian',pending:'Menunggu penilaian langsung'}:{complete:'直接评分已完成',partial:'直接评分中',pending:'待直接评分'};
    parts.push({state:d.state,text:`${text[d.state]} ${d.saved}/${d.total}`});
  }
  if(progress.uncovered)parts.push({state:'unavailable',text:lang==='id'?`${progress.uncovered} item belum tercakup`:`未覆盖 ${progress.uncovered} 项`});
  if(!parts.length)parts.push({state:'unavailable',text:lang==='id'?'Belum ada item penilaian':'暂无评分项目'});
  return parts;
}
function employeeScoringProgressLabel(row,items=[]){return employeeScoringProgressParts(employeeScoringProgress(row,items)).map(part=>part.text).join(' · ');}
function employeeScoringProgressMarkup(row,items=[]){
  const help=lang==='id'?'Praktik mengikuti ujian terakhir yang sudah dinilai dan item yang tercakup. Hanya nilai tersimpan yang dihitung. Inspeksi dan data dihitung terpisah.':'实操按最近已出分考试实际覆盖的项目统计，仅计已保存评分；点检、数据直接评分单独统计。';
  return `<span class="employee-scoring-progress" title="${esc(help)}">${employeeScoringProgressParts(employeeScoringProgress(row,items)).map(part=>`<span class="employee-progress-badge is-${part.state}">${esc(part.text)}</span>`).join('')}</span>`;
}

function practicalEmpty(message){return `<div class="empty"><div class="empty-icon">${icon('target')}</div><h3>${esc(t('现场实操评分'))}</h3><p>${esc(t(message))}</p></div>`;}
async function loadPractical({quiet=false,persisted=false}={}){
  if(!filters.position_id||!filters.workshop_id)return false;
  const positionId=filters.position_id,workshopId=filters.workshop_id,request=++practicalRequest,session=matrixSession;
  captureMatrixDrafts();const target=$('#practical-content');
  if(target&&!quiet)target.innerHTML=`<div class="loading" style="min-height:220px"><span class="spinner"></span>${esc(t('正在加载…'))}</div>`;
  try{const result=await api('/api/practical?position_id='+encodeURIComponent(positionId)+'&workshop_id='+encodeURIComponent(workshopId));if(route!=='practical'||filters.position_id!==positionId||filters.workshop_id!==workshopId||request!==practicalRequest||session!==matrixSession)return false;practicalData=result;practicalScope=matrixCurrentScope();ensureMatrixScoringScope();restorePracticalDrafts(result);const validIds=new Set((result.rows||[]).map(row=>row.employee?.id));for(const id of matrixScoringSelection)if(!validIds.has(id))matrixScoringSelection.delete(id);if(filters.employee_id&&!validIds.has(filters.employee_id))filters.employee_id='';renderPracticalContent();return true;}
  catch(error){if(route==='practical'&&filters.position_id===positionId&&filters.workshop_id===workshopId&&request===practicalRequest&&session===matrixSession&&$('#practical-content')){if(quiet&&practicalData){const state=scoringBatchStates.get(filters.employee_id)||{};if(!state.busy)scoringBatchStates.set(filters.employee_id,{...state,error:persisted?t('已保存，结果加载失败，请刷新页面。'):error.message});renderPracticalContent();}else $('#practical-content').innerHTML=`<div class="empty"><h3>${esc(t('加载失败'))}</h3><p>${esc(error.message)}</p></div>`;}return false;}
}
function practicalAllowed(cell){if(!permitted('score_practical')||cell.can_score_practical!==true)return false;if(isDirectAssessment(cell))return true;const theory=cell.theory_exam_percent,itemTheory=cell.theory_item_percent??cell.knowledge_percent;return Boolean(assessmentCategory(cell))&&theory!=null&&itemTheory!=null&&Number(cell.question_count)>0&&Boolean(cell.assignment_id);}
function practicalBlockedReason(cell){
  if(!permitted('score_practical'))return '当前账号只能查看，不能进行现场实操评分。';
  if(isDirectAssessment(cell))return '当前项目暂不可评分，请刷新页面确认。';
  const status=assessmentStatus(cell);if(status==='theory_pending')return '理论考试尚未完成批改，请等待理论出分。';
  if(status==='category_pending'||!assessmentCategory(cell)&&cell.theory_exam_percent!=null)return '请管理员在员工档案中设置人员类别，再进行现场实操评分。';
  if(cell.assignment_id&&Number(cell.question_count||0)===0)return '本次理论考试未覆盖该项目，不能进行实操评分。';return '尚未安排或完成理论考试，暂不能评分。';
}
function renderPracticalContent(){
  const target=$('#practical-content');if(!target||!practicalData)return;const focus=captureContentFocus(target);
  if(route==='practical'){if(!scoringSourceReady())return;ensureMatrixScoringScope();const controls=$('#matrix-scoring-controls');if(controls)controls.innerHTML=matrixScoringControls();}
  const rows=sortAssessmentEmployeeRows(Array.isArray(practicalData.rows)?practicalData.rows:[]),items=Array.isArray(practicalData.items)?practicalData.items:[];
  if(!items.length){target.innerHTML=practicalEmpty('本岗位还没有作业项目')+`<p class="security-note practical-empty-note">${esc(t('请联系系统管理员配置岗位、作业项目和员工。'))}</p>`;return;}
  if(!rows.length){target.innerHTML=practicalEmpty('本岗位还没有员工');return;}
  if(route==='practical'&&matrixScoringMode==='multi'){target.innerHTML=matrixMultiWorkspace(items);restoreContentFocus(target,focus);return;}
  const selected=rows.find(row=>row.employee?.id===filters.employee_id);
  const chooser=`<div class="practical-employee-picker"><label class="field"><span>${esc(t('选择员工'))}</span><select data-filter="practical_employee">${option('',t('请选择'),filters.employee_id)}${rows.map(row=>option(row.employee.id,`${row.employee.name}${row.employee.employee_no?' · '+row.employee.employee_no:''} · ${employeeScoringProgressLabel(row,items)}`,filters.employee_id)).join('')}</select></label></div>`;
  if(!selected){target.innerHTML=chooser+practicalEmpty('请选择员工后查看理论成绩和各项目实操评分。');return;}
  const cells=selected.cells||[],examItems=items.filter(item=>!isDirectAssessment(item)),theoryCell=cells.find(cell=>!isDirectAssessment(cell)&&cell.theory_exam_percent!=null),theory=theoryCell?.theory_exam_percent;
  const categoryValue={...selected.employee,...selected,assessment_category:selected.assessment_category||selected.employee?.assessment_category||theoryCell?.assessment_category||''};
  const examSummary=examItems.length?`<div><small>${esc(t('理论总分'))}</small><strong>${theory==null?'—':esc(formatScore(theory))}<small> / 100</small></strong></div>`:'';
  const groups=assessmentItemGroups(items).map(group=>`<section class="practical-skill-section"><header class="skill-section-heading"><h3>${esc(t(group.label))}</h3><span>${esc(group.items.length)} ${esc(t('项'))} · ${esc(t((group.key==='exam'||group.key.startsWith('custom:exam_practical:'))?'考试与实操':'直接评分'))}</span></header>${group.key==='exam'?`<div class="practical-category-summary"><div><span>${esc(t('人员类别'))}</span><strong>${esc(categoryLabel(categoryValue,true))}</strong></div><div><span>${esc(t('当前权重'))}</span><strong>${esc(weightsLabel(categoryValue))}</strong></div><p>${esc(compositeFormula(categoryValue))}</p></div>`:`<p class="skill-section-help">${esc(t('按通用矩阵五档直接评分，不需要题库或考试。'))}</p>`}<div class="practical-items">${group.items.map(item=>practicalItem(item,scoringCell(item,cells.find(cell=>cell.work_item_id===item.id)),selected.employee)).join('')}</div></section>`).join('');
  target.innerHTML=chooser+`<div class="practical-employee-summary"><div><strong>${esc(selected.employee.name)}</strong><span>${esc(selected.employee.employee_no||'')}</span>${employeeScoringProgressMarkup(selected,items)}</div>${examSummary}</div>${groups}${practicalBulkBar(selected,'practical')}`;
  restoreContentFocus(target,focus);
}
function practicalItem(item,cell,employee){
  const direct=isDirectAssessment(cell),allowed=employee?.active!==false&&practicalAllowed(cell),theory=cell.theory_item_percent??cell.knowledge_percent,status=assessmentStatus(cell),key=matrixDraftKey(employee.id,item.id,cell.assignment_id),draft=matrixDrafts.get(key),score=draft?draft.score:cell.practical_score,note=draft?draft.note:(cell.practical_note||''),saving=matrixSaving.has(key),saveState=matrixSaveStates.get(key),editable=allowed&&!saving;
  const radios=[1,2,3,4,5].map(value=>`<label class="practical-radio"><input type="radio" name="score" value="${value}" ${score!=null&&Number(score)===value?'checked':''} ${editable?'required':'disabled'} aria-label="${esc(direct?directScoreHint(value):`${t('实操评分')} ${value} / 5`)}"><span>${value}</span><small>${direct?esc(lang==='id'?directScale()[value-1].label_id:directScale()[value-1].label_zh):value===1?esc(lang==='id'?'Terendah':'最低'):value===5?esc(lang==='id'?'Tertinggi':'最高'):''}</small></label>`).join('');
  const summary=direct?`<div class="direct-score-summary">${matrixScoreResult(cell)}</div>`:`<div class="practical-score-summary"><div><span>${esc(t('项目理论分'))}</span><strong>${theory==null?'—':esc(formatScore(theory))}</strong></div><div><span>${esc(t('实操评分'))}</span><strong>${score==null?'—':esc(score)}<small> / 5</small></strong></div><div><span>${esc(t('综合分'))}</span><strong>${status==='completed'&&cell.final_percent!=null?esc(formatScore(cell.final_percent)):'—'}</strong></div></div>`;
  return `<form class="practical-score-form ${direct?'direct-score-form':''}" data-employee="${esc(employee.id)}" data-item="${esc(item.id)}" data-assignment="${esc(cell.assignment_id||'')}"><div class="practical-item-heading"><h3>${esc(lang==='id'?(item.name_id||item.name):item.name)}</h3>${assessmentBadge(cell)}</div>${direct?`<p class="direct-mode-label">${esc(t('直接评分'))} · ${esc(t('无需考试'))}</p>`:''}${summary}${allowed?'':`<div class="notice warning">${esc(t(matrixBlockedReason(cell,employee)))}</div>`}<fieldset class="practical-radio-field" ${editable?'':'disabled'}><legend>${esc(t(direct?'五档评分':'1 分最低 / 5 分最高'))}</legend><div class="practical-radio-row">${radios}</div></fieldset>${direct?directGuidancePanel(item,score):practicalGuidancePanel(item,score)}<label class="field"><span>${esc(t('评分备注（选填）'))}</span><textarea name="note" maxlength="2000" rows="2" ${editable?'':'disabled'}>${esc(note)}</textarea></label>${cell.practical_reviewed_at?`<p class="security-note">${esc(t(direct?'直接评分时间':'实操评分时间'))}: ${esc(formatDate(cell.practical_reviewed_at))}${cell.practical_reviewed_by_name?' · '+esc(t('评分人'))+': '+esc(cell.practical_reviewed_by_name):''}</p>`:''}${scoreHistoryLink(cell,employee)}<div class="practical-error form-error" role="alert" ${saveState?.error?'':'hidden'}>${esc(saveState?.error||'')}</div><button type="submit" class="btn primary" ${editable?'':'disabled'}>${esc(t(saving?'正在保存…':direct?'保存直接评分':'保存实操评分'))}</button><span class="matrix-row-save-state ${draft?'dirty':'saved'}" aria-live="polite">${esc(saving?t('正在保存…'):draft?t('未保存'):score!=null?t('已保存'):'')}</span></form>`;
}
async function submitPractical(form){return savePracticalScores('practical',form);}
const matrixDrafts=new Map(),matrixSaveStates=new Map(),matrixSaving=new Set(),matrixExportSelection=new Set(),scoringBatchStates=new Map(),practicalReviewRequired=new Set(),matrixScoringSelection=new Set();
let matrixRequest=0,matrixScope='',matrixExportSeeded=false,matrixNotice='',matrixSession=0,practicalRequest=0,practicalScope='';
let matrixScoringMode='single',matrixScoringScope='',matrixScoringSearch='',matrixMultiState={},matrixScoringRoute='';
function resetMatrixSession(){invalidateAbilityStats(true);invalidateResultsScoringProgress();persistPracticalDrafts();matrixSession++;matrixRequest++;practicalRequest++;matrixDrafts.clear();matrixSaveStates.clear();matrixSaving.clear();scoringBatchStates.clear();practicalReviewRequired.clear();matrixExportSelection.clear();matrixExportSeeded=false;matrixNotice='';matrixScope='';practicalScope='';matrixScoringRoute='';matrixScoringSelection.clear();matrixScoringMode='single';matrixScoringScope='';matrixScoringSearch='';matrixMultiState={};}
function practicalDraftStorageKey(){return typeof data!=='undefined'&&data.user?.id?'matrix-practical-drafts:'+data.user.id:null;}
function persistPracticalDrafts(){const key=practicalDraftStorageKey();if(!key||typeof browserStore==='undefined')return;const rows=[...matrixDrafts.entries()].map(([scope,value])=>[scope,{score:value.score,note:String(value.note||'').slice(0,2000)}]);if(rows.length)browserStore.setItem(key,JSON.stringify({version:1,saved_at:Date.now(),rows}));else browserStore.removeItem(key);}
function restorePracticalDrafts(source){const key=practicalDraftStorageKey();if(!key||typeof browserStore==='undefined')return;let saved;try{saved=JSON.parse(browserStore.getItem(key)||'null');}catch{return;}if(saved?.version!==1||!Array.isArray(saved.rows)||Date.now()-Number(saved.saved_at)>7*86400000)return;const valid=new Map((source?.rows||[]).flatMap(row=>(row.cells||[]).map(cell=>[matrixDraftKey(row.employee.id,cell.work_item_id,cell.assignment_id),cell])));for(const [scope,draft] of saved.rows){const cell=valid.get(scope);if(!cell||matrixDrafts.has(scope)||!draft||draft.score!==null&&(!Number.isInteger(draft.score)||draft.score<1||draft.score>5)||typeof draft.note!=='string')continue;if(draft.score===(cell.practical_score??null)&&draft.note===(cell.practical_note||''))continue;matrixDrafts.set(scope,{score:draft.score,note:draft.note.slice(0,2000)});}}
async function practicalTimedRequest(operation){const controller=typeof AbortController==='function'?new AbortController():null;let handle;try{return await Promise.race([operation(controller?.signal),new Promise((_,reject)=>{handle=setTimeout(()=>{controller?.abort();const error=new Error('网络响应超时，评分和备注已保留；请重试确认保存结果。 / Koneksi melewati batas waktu. Nilai dan catatan tetap disimpan; coba lagi untuk memastikan hasil.');error.practicalTimeout=true;reject(error);},12000);})]);}finally{clearTimeout(handle);}}
function matrixDraftKey(employeeId,itemId,assignmentId){return JSON.stringify([employeeId,itemId,assignmentId||'']);}
function matrixCurrentScope(){return JSON.stringify([filters.workshop_id||'',filters.position_id||'']);}
function resetMatrixExportSelection(){matrixExportSelection.clear();matrixExportSeeded=false;matrixNotice='';}
function scoringData(kind=route){return kind==='matrix'?matrix:kind==='practical'?practicalData:null;}
function scoringSourceReady(kind=route){return Boolean(scoringData(kind))&&(kind==='matrix'?matrixScope:kind==='practical'?practicalScope:null)===matrixCurrentScope();}
function readPracticalFormScore(form){const select=$('select[name="score"]',form),checked=$('input[name="score"]:checked',form);return select?(select.value===''?null:Number(select.value)):checked?Number(checked.value):null;}
function captureMatrixDrafts(){
  const source=scoringData();if(!source)return;
  $$('.matrix-score-form, .practical-score-form').forEach(form=>{
    const row=source.rows?.find(row=>row.employee?.id===form.dataset.employee),cell=row?.cells?.find(cell=>cell.work_item_id===form.dataset.item);
    if(!cell||String(cell.assignment_id||'')!==String(form.dataset.assignment||''))return;
    const score=readPracticalFormScore(form),note=form.elements.note?.value||'';
    const key=matrixDraftKey(form.dataset.employee,form.dataset.item,form.dataset.assignment);
    if(score!==(cell.practical_score??null)||note!==(cell.practical_note||'')){
      const previous=matrixDrafts.get(key);matrixDrafts.set(key,{score,note});
      if(!matrixSaving.has(key)&&(!previous||previous.score!==score||previous.note!==note)){matrixSaveStates.delete(key);scoringBatchStates.delete(form.dataset.employee);if(!matrixMultiState.busy)matrixMultiState={};}
    }else matrixDrafts.delete(key);
    const hint=$('.practical-score-hint',form);if(hint)hint.textContent=cell.assessment_mode==='direct'?directScoreHint(score):practicalScoreHint(score);
    const status=$('.matrix-row-save-state',form);if(status){status.textContent=matrixSaving.has(key)?t('正在保存…'):matrixDrafts.has(key)?t('未保存'):cell.practical_score!=null?t('已保存'):'';status.className='matrix-row-save-state '+(matrixDrafts.has(key)?'dirty':'saved');}
  });
  persistPracticalDrafts();updatePracticalBulkBar();updateMatrixMultiSaveBar();
}
function practicalChanges(row){
  return (row?.cells||[]).filter(cell=>practicalAllowed(cell)).flatMap(cell=>{
    const draft=matrixDrafts.get(matrixDraftKey(row.employee.id,cell.work_item_id,cell.assignment_id));
    if(!draft||draft.score==null||draft.score===(cell.practical_score??null)&&draft.note===(cell.practical_note||''))return [];
    return [{employee_id:row.employee.id,work_item_id:cell.work_item_id,assignment_id:cell.assignment_id||'',score:draft.score,note:draft.note}];
  });
}
function practicalBulkInfo(row){
  const employeeId=row?.employee?.id,state=scoringBatchStates.get(employeeId)||{},changes=practicalChanges(row);
  const busy=Boolean(state.busy)||(row?.cells||[]).some(cell=>matrixSaving.has(matrixDraftKey(employeeId,cell.work_item_id,cell.assignment_id)));
  const unscored=(row?.cells||[]).filter(cell=>practicalAllowed(cell)&&matrixDrafts.get(matrixDraftKey(employeeId,cell.work_item_id,cell.assignment_id))?.score===null).length;
  const count=changes.length;
  const message=state.error||(busy?t('正在保存…'):count?(lang==='id'?`${count} item belum disimpan`:`${count} 项评分待保存`):state.savedCount!=null?(lang==='id'?`${state.savedCount} nilai tersimpan`:`已保存 ${state.savedCount} 项评分`):t('没有待保存的评分'));
  const hint=unscored?(lang==='id'?`${unscored} item belum diberi nilai dan tidak akan disimpan.`:`另有 ${unscored} 项未选分数，将保持未评分。`):t('仅保存当前员工已选择的评分和备注。');
  return {busy,count,message,hint,error:Boolean(state.error)};
}
function practicalBulkBar(row,kind){
  if(!permitted('score_practical'))return '';
  const info=practicalBulkInfo(row);
  return `<div class="practical-bulk-bar" data-bulk-employee="${esc(row.employee.id)}"><div class="practical-bulk-copy"><strong class="practical-bulk-status ${info.error?'is-error':''}" role="${info.error?'alert':'status'}" aria-live="polite">${esc(info.message)}</strong><span class="practical-bulk-hint">${esc(info.hint)}</span></div><button type="button" class="btn primary" data-action="${kind}-save-all" ${info.busy||!info.count?'disabled':''}>${esc(t(info.busy?'正在保存…':'一键保存评分'))}</button></div>`;
}
function updatePracticalBulkBar(){
  const source=scoringData();if(!source)return;
  $$('[data-bulk-employee]').forEach(bar=>{
    const row=source.rows?.find(row=>row.employee?.id===bar.dataset.bulkEmployee);if(!row)return;
    const info=practicalBulkInfo(row),status=$('.practical-bulk-status',bar),hint=$('.practical-bulk-hint',bar),button=$('button',bar);
    if(status){status.textContent=info.message;status.classList.toggle('is-error',info.error);status.setAttribute('role',info.error?'alert':'status');}
    if(hint)hint.textContent=info.hint;
    if(button){button.disabled=info.busy||!info.count;button.textContent=t(info.busy?'正在保存…':'一键保存评分');}
  });
}
function renderScoringContent(kind){if(route!==kind)return;if(kind==='matrix')renderMatrixContent();else renderPracticalContent();}
async function savePracticalScores(kind,form=null,reviewConfirmed=false){
  if(route!==kind||kind==='matrix'&&matrixScope!==matrixCurrentScope())return;
  captureMatrixDrafts();
  const source=scoringData(kind),employeeId=form?.dataset.employee||filters.employee_id,row=source?.rows?.find(row=>row.employee?.id===employeeId);
  if(!row||practicalBulkInfo(row).busy)return;
  const scope=matrixCurrentScope(),session=matrixSession;
  let scores=practicalChanges(row);
  const showError=message=>{scoringBatchStates.set(employeeId,{error:message});if(form)matrixSaveStates.set(matrixDraftKey(employeeId,form.dataset.item,form.dataset.assignment),{error:message});if(session===matrixSession&&['matrix','practical'].includes(route)){captureMatrixDrafts();renderScoringContent(route);}};
  if(form){
    const cell=row.cells?.find(cell=>cell.work_item_id===form.dataset.item),checked=$('input[name="score"]:checked',form);
    if(!cell||!practicalAllowed(cell)){showError(t(matrixBlockedReason(cell||{},row.employee)));return;}
    if(String(form.dataset.assignment||'')!==String(cell.assignment_id||'')){showError(t('考试记录已更新，请刷新后重新选择本次考试评分。'));return;}
    scores=[{employee_id:employeeId,work_item_id:cell.work_item_id,assignment_id:cell.assignment_id||'',score:checked?Number(checked.value):null,note:form.elements.note?.value||''}];
  }
  if(!scores.length){toast(t('没有待保存的评分'));return;}
  if(scores.some(score=>!Number.isInteger(score.score)||score.score<1||score.score>5)){showError(t('请输入 1～5 的整数评分，不默认打分。'));return;}
  if(practicalReviewRequired.has(employeeId)&&!reviewConfirmed){
    const rows=scores.map(score=>{const cell=row.cells?.find(cell=>cell.work_item_id===score.work_item_id),item=find('work_items',score.work_item_id);return `<p><strong>${esc(item?.name||score.work_item_id)}</strong><br>${esc(lang==='id'?'Nilai server saat ini':'服务器当前评分')}：${esc(cell?.practical_score??'—')} / 5 → ${esc(lang==='id'?'Nilai yang akan disimpan':'本次拟保存')}：${esc(score.score)} / 5</p>`;}).join('');
    const itemId=form?.dataset.item,assignmentId=form?.dataset.assignment;
    openEditor(lang==='id'?'Periksa nilai sebelum mencoba lagi':'重试前核对评分',lang==='id'?'Permintaan sebelumnya mungkin telah tersimpan. Periksa nilai server dan pilihan Anda sebelum mengonfirmasi.':'上次请求可能已经保存，请核对当前服务器评分与本次选择，再确认保存。',rows,async()=>{if(route!==kind||matrixCurrentScope()!==scope||filters.employee_id!==employeeId)throw new Error(lang==='id'?'Pilihan karyawan berubah. Tutup dialog dan periksa lagi.':'员工或车间选择已变更，请关闭后重新核对。');closeEditor();const activeForm=itemId?$$('.matrix-score-form, .practical-score-form').find(f=>f.dataset.employee===employeeId&&f.dataset.item===itemId&&f.dataset.assignment===assignmentId):null;if(itemId&&!activeForm)throw new Error(t('考试记录已更新，请刷新后重新选择本次考试评分。'));await savePracticalScores(kind,activeForm,true);},lang==='id'?'Konfirmasi dan simpan':'确认并保存');return;
  }
  scores=scores.map(score=>({...score,expected_reviewed_at:row.cells?.find(cell=>cell.work_item_id===score.work_item_id)?.practical_reviewed_at||''}));
  const locked=(row.cells||[]).map(cell=>matrixDraftKey(employeeId,cell.work_item_id,cell.assignment_id));
  locked.forEach(key=>matrixSaving.add(key));scores.forEach(score=>matrixSaveStates.delete(matrixDraftKey(employeeId,score.work_item_id,score.assignment_id)));
  scoringBatchStates.set(employeeId,{busy:true});renderScoringContent(kind);
  try{
    const result=await practicalTimedRequest(signal=>api(form?'/api/practical/score':'/api/practical/score-batch',{method:'POST',body:form?scores[0]:{scores},...(signal?{signal}:{})}));
    if(session!==matrixSession)return;
    resultsScoringChanged();captureMatrixDrafts();const results=form?[result]:result.results;
    scores.forEach((score,index)=>{
      const key=matrixDraftKey(employeeId,score.work_item_id,score.assignment_id),draft=matrixDrafts.get(key),cell=row.cells.find(cell=>cell.work_item_id===score.work_item_id),assessment=results?.[index]?.assessment;
      if(assessment&&cell&&String(assessment.assignment_id||'')===String(cell.assignment_id||''))Object.assign(cell,assessment);
      const visibleCell=scoringData()?.rows?.find(visibleRow=>visibleRow.employee?.id===employeeId)?.cells?.find(visibleCell=>visibleCell.work_item_id===score.work_item_id);
      if(assessment&&visibleCell&&String(assessment.assignment_id||'')===String(visibleCell.assignment_id||''))Object.assign(visibleCell,assessment);
      if(draft?.score===score.score&&draft.note===score.note)matrixDrafts.delete(key);
      matrixSaveStates.set(key,{saved:true});
    });
    locked.forEach(key=>matrixSaving.delete(key));
    const message=lang==='id'?`${scores.length} nilai tersimpan`:`已保存 ${scores.length} 项评分`;
    practicalReviewRequired.delete(employeeId);persistPracticalDrafts();scoringBatchStates.set(employeeId,{savedCount:scores.length});matrixNotice='';
    if(['matrix','practical'].includes(route)){const visibleKind=route;renderScoringContent(visibleKind);if(matrixCurrentScope()===scope){if(visibleKind==='matrix')await loadMatrix({quiet:true,persisted:true});else await loadPractical({quiet:true,persisted:true});}toast(message);}
  }catch(error){
    if(session!==matrixSession)return;
    locked.forEach(key=>matrixSaving.delete(key));
    if(error.status===409||error.practicalTimeout){practicalReviewRequired.add(employeeId);const visibleKind=route;showError(error.practicalTimeout?error.message:t('考试记录或服务器评分已更新，请核对后重试。'));if(['matrix','practical'].includes(visibleKind)&&matrixCurrentScope()===scope){if(visibleKind==='matrix')await loadMatrix({quiet:true});else await loadPractical({quiet:true});}}
    else showError(t('保存失败，评分和备注已保留，请重试。')+(error.message?' '+error.message:''));
    persistPracticalDrafts();
  }
}
// Multi-person saves share row locks, draft keys and CAS rules with single saves.
function matrixMultiInfo(){
  const rows=matrixSelectedScoringRows().filter(row=>row.employee?.active!==false);
  const changes=rows.map(row=>({row,scores:practicalChanges(row)}));
  const count=changes.reduce((sum,entry)=>sum+entry.scores.length,0);
  const employeeCount=changes.filter(entry=>entry.scores.length).length;
  const state=matrixMultiState||{},busy=Boolean(state.busy)||rows.some(row=>practicalBulkInfo(row).busy);
  const tooMany=count>500;
  const unscored=rows.reduce((sum,row)=>sum+(row.cells||[]).filter(cell=>{
    if(!practicalAllowed(cell))return false;
    const draft=matrixDrafts.get(matrixDraftKey(row.employee.id,cell.work_item_id,cell.assignment_id));
    return (draft?draft.score:cell.practical_score)==null;
  }).length,0);
  const limitMessage=lang==='id'?'Maksimal 500 nilai sekali simpan. Kurangi pilihan karyawan.':'一次最多保存 500 项评分，请减少本次选择的员工。';
  const message=busy?t('正在保存…'):tooMany?limitMessage:state.error||
    (count?(lang==='id'?`${employeeCount} karyawan · ${count} nilai belum disimpan`:`${employeeCount} 名员工 · ${count} 项评分待保存`):
      state.savedCount!=null?(lang==='id'?`${state.savedEmployeeCount||0} karyawan · ${state.savedCount} nilai tersimpan`:`已保存 ${state.savedEmployeeCount||0} 名员工的 ${state.savedCount} 项评分`):t('没有待保存的评分'));
  const hint=lang==='id'?
    `Hanya nilai dan catatan karyawan terpilih yang disimpan. ${unscored?`${unscored} item tanpa nilai tetap belum dinilai.`:'Item tanpa pilihan tetap belum dinilai.'}`:
    `仅保存所选员工已选择的评分和备注。${unscored?`另有 ${unscored} 项未选分数，将保持未评分。`:'未选分数的项目保持未评分。'}`;
  return {busy,count,employeeCount,message,hint,error:Boolean(state.error)||tooMany,tooMany};
}

function updateMatrixMultiSaveBar(){
  const bars=$$('[data-multi-save-bar]');if(!bars.length)return;
  const info=matrixMultiInfo();
  bars.forEach(bar=>{
    const status=$('.practical-bulk-status',bar),hint=$('.practical-bulk-hint',bar),button=$('button',bar);
    if(status){status.textContent=info.message;status.classList.toggle('is-error',info.error);status.setAttribute('role',info.error?'alert':'status');}
    if(hint)hint.textContent=info.hint;
    if(button){button.disabled=info.busy||!info.count||info.tooMany;button.textContent=info.busy?t('正在保存…'):lang==='id'?'Simpan nilai karyawan terpilih':'保存所选员工评分';}
  });
}

function matrixMultiScores(rows){
  return rows.filter(row=>row.employee?.active!==false).flatMap(row=>practicalChanges(row).map(score=>({
    ...score,expected_reviewed_at:row.cells?.find(cell=>cell.work_item_id===score.work_item_id&&String(cell.assignment_id||'')===String(score.assignment_id||''))?.practical_reviewed_at||''
  })));
}

function matrixMultiSnapshot(rows,scores){
  return JSON.stringify({session:matrixSession,scope:matrixCurrentScope(),mode:matrixScoringMode,
    selection:[...matrixScoringSelection].sort(),employees:rows.map(row=>row.employee.id),scores});
}

function matrixMultiCheckedResults(result,scores){
  if(!Array.isArray(result?.results)||result.results.length!==scores.length)return null;
  const checked=[];
  for(let index=0;index<scores.length;index++){
    const score=scores[index],entry=result.results[index],record=entry?.practical||entry?.direct,assessment=entry?.assessment;
    if(!record||!assessment||record.employee_id!==score.employee_id||record.work_item_id!==score.work_item_id||
      String(record.assignment_id||'')!==String(score.assignment_id||'')||assessment.work_item_id!==score.work_item_id||
      String(assessment.assignment_id||'')!==String(score.assignment_id||'')||record.score!==score.score||
      assessment.practical_score!==score.score||String(record.note||'')!==String(score.note||'').trim())return null;
    checked.push({score,assessment});
  }
  return checked;
}

async function saveMatrixMultiScores(reviewConfirmed=false){
  const kind=route;if(!['matrix','practical'].includes(kind)||matrixScoringMode!=='multi'||!scoringSourceReady(kind))return;
  ensureMatrixScoringScope();
  if(matrixScoringScope!==matrixCurrentScope())return;
  captureMatrixDrafts();
  const rows=matrixSelectedScoringRows().filter(row=>row.employee?.active!==false),info=matrixMultiInfo();
  if(info.busy)return;
  const scope=matrixCurrentScope(),session=matrixSession,scores=matrixMultiScores(rows);
  const selection=JSON.stringify([...matrixScoringSelection].sort());
  const visibleScope=()=>session===matrixSession&&matrixCurrentScope()===scope;
  const visibleScoring=()=>visibleScope()&&['matrix','practical'].includes(route)&&scoringSourceReady();
  const visibleOrigin=()=>visibleScoring()&&route===kind;
  const showBeforeSaveError=message=>{
    matrixMultiState={scope,selection,error:message};
    updateMatrixMultiSaveBar();
  };
  if(!scores.length){toast(t('没有待保存的评分'));return;}
  if(scores.length>500){showBeforeSaveError(lang==='id'?'Maksimal 500 nilai sekali simpan. Kurangi pilihan karyawan.':'一次最多保存 500 项评分，请减少本次选择的员工。');return;}
  if(scores.some(score=>!Number.isInteger(score.score)||score.score<1||score.score>5)){
    showBeforeSaveError(t('请输入 1～5 的整数评分，不默认打分。'));return;
  }
  const ids=[...new Set(scores.map(score=>score.employee_id))],rowById=new Map(rows.map(row=>[row.employee.id,row]));
  if(ids.some(id=>practicalReviewRequired.has(id))&&!reviewConfirmed){
    const snapshot=matrixMultiSnapshot(rows,scores);
    const body=ids.map(id=>{
      const row=rowById.get(id),items=scores.filter(score=>score.employee_id===id).map(score=>{
        const cell=row.cells?.find(cell=>cell.work_item_id===score.work_item_id),item=find('work_items',score.work_item_id);
        return `<p><strong>${esc(lang==='id'?(item?.name_id||item?.name||score.work_item_id):(item?.name||score.work_item_id))}</strong><br>${esc(lang==='id'?'Nilai server saat ini':'服务器当前评分')}：${esc(cell?.practical_score??'—')} / 5 → ${esc(lang==='id'?'Nilai yang akan disimpan':'本次拟保存')}：${esc(score.score)} / 5${score.note?`<br>${esc(t('评分备注（选填）'))}：${esc(score.note)}`:''}</p>`;
      }).join('');
      return `<section><h3>${esc(row.employee.name)}${row.employee.employee_no?` · ${esc(row.employee.employee_no)}`:''}</h3>${items}</section>`;
    }).join('');
    openEditor(lang==='id'?'Periksa nilai sebelum mencoba lagi':'重试前核对评分',
      lang==='id'?'Permintaan sebelumnya mungkin telah tersimpan. Periksa setiap karyawan sebelum mengonfirmasi.':'上次请求可能已经保存，请逐人核对服务器当前评分和本次选择，再确认保存。',body,async()=>{
        if(!visibleOrigin()||matrixScoringMode!=='multi'||matrixScoringScope!==scope||JSON.stringify([...matrixScoringSelection].sort())!==selection)
          throw new Error(lang==='id'?'Pilihan karyawan atau area kerja berubah. Tutup dialog dan periksa lagi.':'员工、车间或岗位选择已变更，请关闭后重新核对。');
        captureMatrixDrafts();
        const currentRows=matrixSelectedScoringRows().filter(row=>row.employee?.active!==false);
        if(matrixMultiSnapshot(currentRows,matrixMultiScores(currentRows))!==snapshot)
          throw new Error(lang==='id'?'Nilai atau catatan berubah. Tutup dialog dan periksa lagi.':'评分、备注或服务器版本已变更，请关闭后重新核对。');
        closeEditor();await saveMatrixMultiScores(true);
      },lang==='id'?'Konfirmasi dan simpan':'确认并保存');
    return;
  }

  // Lock whole participating rows so single and multi saves cannot overlap.
  const locked=ids.flatMap(id=>(rowById.get(id).cells||[]).map(cell=>matrixDraftKey(id,cell.work_item_id,cell.assignment_id)));
  const state={scope,selection,busy:true};matrixMultiState=state;
  const ownState=()=>visibleOrigin()&&matrixScoringRoute===kind&&matrixScoringScope===scope&&matrixMultiState===state;
  // Refreshing results may overlap a newer save. Only release our locks once,
  // and never replace another request's per-person state from a late callback.
  let locksHeld=true;
  const ownedPersonStates=new Map();
  const writePersonState=(id,value)=>{
    if(ownedPersonStates.has(id)&&scoringBatchStates.get(id)!==ownedPersonStates.get(id))return false;
    scoringBatchStates.set(id,value);ownedPersonStates.set(id,value);return true;
  };
  const releaseLocks=()=>{
    if(!locksHeld)return;locksHeld=false;
    if(session===matrixSession)locked.forEach(key=>matrixSaving.delete(key));
  };
  locked.forEach(key=>matrixSaving.add(key));
  scores.forEach(score=>matrixSaveStates.delete(matrixDraftKey(score.employee_id,score.work_item_id,score.assignment_id)));
  ids.forEach(id=>writePersonState(id,{busy:true}));
  renderScoringContent(kind);
  let savedOnServer=false;
  try{
    const result=await practicalTimedRequest(signal=>api('/api/practical/score-batch',{method:'POST',body:{scores},...(signal?{signal}:{})}));
    if(session!==matrixSession)return;
    const checked=matrixMultiCheckedResults(result,scores);
    if(!checked){
      const error=new Error(lang==='id'?'Hasil penyimpanan tidak lengkap. Nilai dan catatan tetap disimpan; periksa hasil server sebelum mencoba lagi.':'保存结果不完整，评分和备注已保留；请核对服务器结果后重试。');
      error.practicalUncertain=true;throw error;
    }
    savedOnServer=true;resultsScoringChanged();
    captureMatrixDrafts();
    checked.forEach(({score,assessment})=>{
      const key=matrixDraftKey(score.employee_id,score.work_item_id,score.assignment_id),draft=matrixDrafts.get(key);
      const originalCell=rowById.get(score.employee_id)?.cells?.find(cell=>cell.work_item_id===score.work_item_id&&String(cell.assignment_id||'')===String(score.assignment_id||''));
      if(originalCell)Object.assign(originalCell,assessment);
      // Only a currently visible matching scope may receive late results.
      if(visibleScoring()){
        const visibleCell=scoringData()?.rows?.find(row=>row.employee?.id===score.employee_id)?.cells?.find(cell=>cell.work_item_id===score.work_item_id&&String(cell.assignment_id||'')===String(score.assignment_id||''));
        if(visibleCell&&visibleCell!==originalCell)Object.assign(visibleCell,assessment);
      }
      if(draft?.score===score.score&&draft.note===score.note)matrixDrafts.delete(key);
      matrixSaveStates.set(key,{saved:true});
    });
    releaseLocks();
    ids.forEach(id=>{practicalReviewRequired.delete(id);writePersonState(id,{savedCount:scores.filter(score=>score.employee_id===id).length});});
    persistPracticalDrafts();
    if(ownState())Object.assign(state,{busy:false,savedCount:scores.length,savedEmployeeCount:ids.length});
    const message=lang==='id'?`${ids.length} karyawan · ${scores.length} nilai tersimpan`:`已保存 ${ids.length} 名员工的 ${scores.length} 项评分`;
    if(visibleScoring()){
      const visibleKind=route;matrixNotice='';renderScoringContent(visibleKind);
      const loaded=await (visibleKind==='matrix'?loadMatrix({quiet:true,persisted:true}):loadPractical({quiet:true,persisted:true}));
      if(loaded===false&&ownState()){
        state.error=lang==='id'?'Nilai tersimpan, tetapi hasil gagal dimuat. Muat ulang untuk memeriksa.':'评分已保存，但结果加载失败，请刷新核对。';
        updateMatrixMultiSaveBar();
      }
      if(visibleScoring())toast(message);
    }
  }catch(error){
    if(session!==matrixSession)return;
    releaseLocks();
    const uncertain=Boolean(error.status===409||error.practicalTimeout||error.practicalUncertain||savedOnServer);
    const message=savedOnServer?(lang==='id'?'Nilai sudah disimpan, tetapi tampilan belum diperbarui. Periksa hasil server sebelum mencoba lagi.':'评分已保存，但页面未能完整更新，请先核对服务器结果。'):
      error.practicalTimeout||error.practicalUncertain?error.message:
      error.status===409?t('考试记录或服务器评分已更新，请核对后重试。'):
      t('保存失败，评分和备注已保留，请重试。')+(error.message?' '+error.message:'');
    ids.forEach(id=>{if(writePersonState(id,{error:message})&&uncertain)practicalReviewRequired.add(id);});
    if(ownState())Object.assign(state,{busy:false,error:message});
    persistPracticalDrafts();
    if(visibleScoring()){
      const visibleKind=route;renderScoringContent(visibleKind);
      if(uncertain)await (visibleKind==='matrix'?loadMatrix({quiet:true}):loadPractical({quiet:true}));
    }
  }finally{
    if(session===matrixSession){
      releaseLocks();
      ids.forEach(id=>{const rowState=scoringBatchStates.get(id);if(rowState?.busy&&rowState===ownedPersonStates.get(id))scoringBatchStates.delete(id);});
      if(ownState())state.busy=false;
      if(visibleScoring())updateMatrixMultiSaveBar();
    }
  }
}

function ensureMatrixScoringScope(){
  const scope=matrixCurrentScope();if(matrixScoringScope===scope&&matrixScoringRoute===route)return;
  matrixScoringScope=scope;matrixScoringRoute=route;matrixScoringSelection.clear();matrixScoringSearch='';matrixMultiState={};
}
function matrixScoringRows(){const source=scoringData();return scoringSourceReady()?sortAssessmentEmployeeRows(Array.isArray(source?.rows)?source.rows:[]).filter(row=>row.employee?.id):[];}
function matrixSelectedScoringRows(){return matrixScoringRoute===route&&matrixScoringScope===matrixCurrentScope()?matrixScoringRows().filter(row=>matrixScoringSelection.has(row.employee.id)):[];}
function visibleMatrixScoringRows(){const search=matrixScoringSearch.trim().toLocaleLowerCase();return matrixScoringRows().filter(row=>!search||`${row.employee.name||''} ${row.employee.employee_no||''}`.toLocaleLowerCase().includes(search));}
function matrixScoringEmployeeList(){
  const rows=visibleMatrixScoringRows();
  return rows.length?rows.map(row=>`<label><input type="checkbox" data-matrix-score-employee value="${esc(row.employee.id)}" ${matrixScoringSelection.has(row.employee.id)?'checked':''}><span><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employee_no||'')}</small>${employeeScoringProgressMarkup(row,scoringData()?.items||[])}</span></label>`).join(''):`<p class="security-note">${lang==='id'?'Tidak ada karyawan yang cocok.':'没有匹配的员工。'}</p>`;
}
function matrixScoringControls(){
  ensureMatrixScoringScope();const count=matrixSelectedScoringRows().length,rows=matrixScoringRows();
  return `<div class="matrix-scoring-mode" role="group" aria-label="${lang==='id'?'Cara penilaian':'评分方式'}"><strong>${lang==='id'?'Cara penilaian':'评分方式'}</strong>${[['single','单人评分','Satu karyawan'],['multi','多人评分','Beberapa karyawan']].map(([mode,zh,id])=>`<button type="button" class="btn secondary small" data-action="matrix-score-mode" data-mode="${mode}" aria-pressed="${matrixScoringMode===mode}">${esc(lang==='id'?id:zh)}</button>`).join('')}</div>${matrixScoringMode==='multi'?`<section class="matrix-multi-picker" aria-label="${lang==='id'?'Pilih karyawan untuk dinilai':'勾选评分员工'}"><div class="matrix-multi-picker-tools"><input type="search" data-matrix-score-search aria-label="${lang==='id'?'Cari nama atau NIK':'搜索姓名或工号'}" placeholder="${lang==='id'?'Cari nama atau NIK':'搜索姓名或工号'}" value="${esc(matrixScoringSearch)}"><button type="button" class="btn secondary small" data-action="matrix-multi-all" ${rows.length?'':'disabled'}>${lang==='id'?'Pilih hasil pencarian':'全选当前名单'}</button><button type="button" class="btn secondary small" data-action="matrix-multi-none" ${count?'':'disabled'}>${lang==='id'?'Hapus pilihan':'清空选择'}</button><span role="status" aria-live="polite">${lang==='id'?`${count} karyawan dipilih`:`已选择 ${count} 人`}</span></div><div class="matrix-multi-employee-list" id="matrix-multi-employee-list">${matrixScoringEmployeeList()}</div><p class="security-note">${lang==='id'?'Nama berhuruf Han ditampilkan lebih dahulu. Nilai diisi terpisah untuk setiap karyawan.':'中文姓名在前。勾选多人后，在下表分别选择每个人的评分。'}</p></section>`:''}`;
}
function setMatrixScoringMode(mode){
  if(!['single','multi'].includes(mode))return;captureMatrixDrafts();ensureMatrixScoringScope();
  if(mode==='multi'&&!matrixScoringSelection.size&&matrixScoringRows().some(row=>row.employee.id===filters.employee_id))matrixScoringSelection.add(filters.employee_id);
  matrixScoringMode=mode;const single=$('[data-filter="matrix_employee"]')?.closest?.('label');if(single)single.hidden=mode==='multi';renderScoringContent(route);
  if(!scoringSourceReady()){const controls=$('#matrix-scoring-controls');if(controls)controls.innerHTML=matrixScoringControls();}
}
function changeMatrixScoringSelection(value,checked){
  captureMatrixDrafts();ensureMatrixScoringScope();
  if(checked&&matrixScoringRows().some(row=>row.employee.id===value))matrixScoringSelection.add(value);else matrixScoringSelection.delete(value);
  renderScoringContent(route);$$('[data-matrix-score-employee]').find(input=>input.value===value)?.focus?.({preventScroll:true});
}
function selectMatrixScoringEmployees(all){
  captureMatrixDrafts();ensureMatrixScoringScope();
  if(all)visibleMatrixScoringRows().forEach(row=>matrixScoringSelection.add(row.employee.id));else matrixScoringSelection.clear();
  renderScoringContent(route);
}
function matrixMultiSaveBar(){
  if(!permitted('score_practical'))return '';
  const info=matrixMultiInfo();
  return `<div class="matrix-multi-save-bar" data-multi-save-bar><div class="practical-bulk-copy"><strong class="practical-bulk-status ${info.error?'is-error':''}" role="${info.error?'alert':'status'}" aria-live="polite">${esc(info.message)}</strong><span class="practical-bulk-hint">${esc(info.hint)}</span></div><button type="button" class="btn primary" data-action="matrix-multi-save" ${info.busy||!info.count||info.tooMany?'disabled':''}>${esc(info.busy?t('正在保存…'):lang==='id'?'Simpan nilai karyawan terpilih':'保存所选员工评分')}</button></div>`;
}
function matrixMultiScoreCell(item,cell,employee){
  const direct=isDirectAssessment(cell),key=matrixDraftKey(employee.id,item.id,cell.assignment_id),draft=matrixDrafts.get(key),score=draft?draft.score:(cell.practical_score??null),note=draft?draft.note:(cell.practical_note||''),saving=matrixSaving.has(key),allowed=employee.active!==false&&practicalAllowed(cell),editable=allowed&&!saving,saveState=matrixSaveStates.get(key),theory=cell.theory_item_percent??cell.knowledge_percent;
  const choices=option('',lang==='id'?'Pilih nilai':'请选择评分',score??'')+directScale().map(row=>option(row.score,`${row.score} · ${lang==='id'?row.label_id:row.label_zh}`,score??'')).join('');
  return `<form class="matrix-score-form matrix-multi-score-cell" data-employee="${esc(employee.id)}" data-item="${esc(item.id)}" data-assignment="${esc(cell.assignment_id||'')}"><div class="matrix-multi-cell-meta">${direct?esc(lang==='id'?'Penilaian langsung · Tanpa ujian':'直接评分 · 无需考试'):`${esc(t('项目理论分'))} <strong>${theory==null?'—':esc(formatScore(theory))}</strong> / 100`}</div><label class="field"><span class="sr-only">${esc(employee.name)} · ${esc(lang==='id'?(item.name_id||item.name):item.name)} · ${esc(t('现场实操评分'))}</span><select name="score" data-multi-score class="matrix-multi-score-select" ${editable?'':'disabled'}>${choices}</select></label><span class="matrix-row-save-state ${draft?'dirty':'saved'}" aria-live="polite">${esc(saving?t('正在保存…'):draft?t('未保存'):score!=null?t('已保存'):'')}</span><details class="matrix-multi-note" ${draft?.note&&draft.note!==(cell.practical_note||'')?'open':''}><summary>${esc(t('评分备注（选填）'))}</summary><textarea name="note" rows="2" maxlength="2000" aria-label="${esc(employee.name)} · ${esc(item.name)} · ${esc(t('评分备注（选填）'))}" ${editable?'':'disabled'}>${esc(note)}</textarea></details>${allowed?'':`<p class="matrix-blocked-reason">${esc(t(matrixBlockedReason(cell,employee)))}</p>`}<div class="matrix-score-error form-error" role="alert" ${saveState?.error?'':'hidden'}>${esc(saveState?.error||'')}</div><div class="matrix-multi-cell-meta">${matrixScoreResult(cell)}</div></form>`;
}
function matrixMultiWorkspace(items){
  const rows=matrixSelectedScoringRows();
  if(!rows.length)return matrixEmpty(lang==='id'?'Centang karyawan di atas untuk mulai menilai.':'勾选上方员工后，即可在同一张表中分别评分。');
  const hasExamItems=items.some(item=>!isDirectAssessment(item));
  const header=rows.map(row=>{const cell=(row.cells||[]).find(value=>!isDirectAssessment(value)&&value.assessment_category),category={...row.employee,...row,assessment_category:row.assessment_category||row.employee.assessment_category||cell?.assessment_category||''};return `<th scope="col"><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employee_no||'')}</small><small>${esc(hasExamItems?weightsLabel(category):t('直接评分'))}</small>${employeeScoringProgressMarkup(row,items)}</th>`;}).join('');
  const body=assessmentItemGroups(items).map(group=>`<tr class="matrix-skill-group"><th colspan="${rows.length+1}" scope="rowgroup">${esc(t(group.label))} · ${group.items.length} ${esc(t('项'))}</th></tr>${group.items.map(item=>`<tr><th scope="row"><strong>${esc(lang==='id'?(item.name_id||item.name):item.name)}</strong>${item.name_id&&lang==='zh'?`<small>${esc(item.name_id)}</small>`:''}</th>${rows.map(row=>`<td>${matrixMultiScoreCell(item,scoringCell(item,(row.cells||[]).find(cell=>cell.work_item_id===item.id)),row.employee)}</td>`).join('')}</tr>`).join('')}`).join('');
  return `<section class="${route==='practical'?'':'panel '}matrix-multi-roster"><div class="matrix-multi-title"><h2>${lang==='id'?'Penilaian beberapa karyawan':'多人评分'}</h2><p>${lang==='id'?`${rows.length} karyawan · ${items.length} item. Geser tabel ke samping untuk melihat karyawan lain.`:`${rows.length} 人 · ${items.length} 项作业。可左右滑动表格查看其他员工。`}</p></div><div class="matrix-multi-table-wrap" tabindex="0" role="region" aria-label="${lang==='id'?'Tabel penilaian karyawan terpilih':'所选员工评分表'}"><table class="matrix-multi-table"><thead><tr><th scope="col">${esc(t('作业项目'))}</th>${header}</tr></thead><tbody>${body}</tbody></table></div><p class="matrix-workbench-foot">${esc(t('点检、数据等技能直接评分；考试作业按理论与实操加权。'))}</p>${matrixMultiSaveBar()}</section>`;
}

function matrixPage(){
  ensureMatrixScoringScope();
  if(data.user?.workshop_id&&data.user.role!=='admin')filters.workshop_id=data.user.workshop_id;
  if(!filters.workshop_id&&list('workshops').length===1)filters.workshop_id=list('workshops')[0].id;
  if(filters.position_id&&!positionMatchesWorkshop(find('positions',filters.position_id),filters.workshop_id)){filters.position_id='';filters.employee_id='';}
  const hasScope=Boolean(filters.workshop_id&&filters.position_id),rows=matrixScope===matrixCurrentScope()?(matrix?.rows||[]):[];
  const actions=btn('matrix-export-selected','选择员工导出',hasScope?'':'disabled','primary','download')+btn('export-workshop','导出全车间',filters.workshop_id?'':'disabled','secondary','');
  const description=data.user?.workshop_id&&data.user.role!=='admin'?'可为本车间多人分别评分，一键保存；也可导出所选员工或全车间能力矩阵。':'可单人或多选员工分别评分，一键保存；也可按通用矩阵导出能力矩阵。';
  return pageHeading('能力矩阵',description,actions)+directAssessmentNotice()+
    `<div class="assessment-flow" aria-label="${esc(t('答题分数'))} + ${esc(t('现场实操评分'))} = ${esc(t('能力矩阵月亮图'))}"><div><span class="assessment-flow-icon">${icon('clipboard')}</span><span><strong>${esc(t('答题分数'))}</strong><small>${esc(t('理论出分即可进行实操评分，不设最低分限制'))}</small></span></div><b aria-hidden="true">＋</b><div><span class="assessment-flow-icon">${icon('target')}</span><span><strong>${esc(t('现场实操评分'))}</strong><small>${esc(t('按 1～5 分现场评分'))}</small></span></div><b aria-hidden="true">＝</b><div><span class="assessment-flow-icon">${moon(3)}</span><span><strong>${esc(t('能力矩阵月亮图'))}</strong><small>${esc(t('按人员类别加权计算'))}</small></span></div></div>`+
    `<section class="panel matrix-filter-panel"><div class="matrix-workbench-filters"><label class="field"><span>${esc(t('编号车间'))}</span><select id="matrix-workshop-select" data-filter="matrix_workshop" ${data.user?.workshop_id&&data.user.role!=='admin'?'disabled':''}>${selectOptions('workshops',filters.workshop_id,'请选择')}</select></label><label class="field"><span>${esc(t('所属岗位'))}</span><select data-filter="matrix_position" ${filters.workshop_id?'':'disabled'}>${positionOptions(filters.position_id,'请选择',position=>positionMatchesWorkshop(position,filters.workshop_id))}</select></label><label class="field matrix-single-employee" ${matrixScoringMode==='multi'?'hidden':''}><span>${esc(t('选择员工'))}</span><select data-filter="matrix_employee" ${hasScope&&rows.length?'':'disabled'}>${matrixEmployeeOptions(rows)}</select></label></div><div id="matrix-scoring-controls">${matrixScoringControls()}</div></section>`+
    `<div id="matrix-content">${hasScope?matrixLoading():matrixEmpty()}</div>`+
    `<div class="matrix-secondary-tools">${ratingRulesPanel()}${hasScope?`<a class="matrix-csv-link" href="${esc(matrixCsvUrl())}">${esc(t('导出 CSV'))}</a>`:''}</div>`;
}
function matrixLoading(){return `<div class="loading" style="min-height:200px"><span class="spinner"></span>${esc(t('正在加载…'))}</div>`;}
function matrixEmpty(message='先选择车间和岗位，再选择员工'){return `<section class="panel"><div class="empty"><div class="empty-icon">${icon('target')}</div><h3>${esc(t(message))}</h3><p>${esc(t('查看本岗位员工的答题、实操和直接评分结果。'))}</p></div></section>`;}
function matrixEmployeeOptions(rows,items=matrix?.items||[]){return option('',t('请选择员工'),filters.employee_id)+sortAssessmentEmployeeRows(rows).map(row=>option(row.employee.id,`${row.employee.name}${row.employee.employee_no?' · '+row.employee.employee_no:''} · ${employeeScoringProgressLabel(row,items)}`,filters.employee_id)).join('');}
function matrixCsvUrl(){const query=new URLSearchParams({workshop_id:filters.workshop_id||'',position_id:filters.position_id||''});return '/api/export/matrix.csv?'+query.toString();}
function dimensionEvidence(cell){
  const scores=cell.dimension_scores||{};const entries=Array.isArray(scores)?scores.map(v=>[v.dimension||v.key,v]):Object.entries(scores);
  return entries.filter(([key])=>Object.prototype.hasOwnProperty.call(dimensions,key)).map(([key,value])=>{const d=typeof value==='object'&&value?value:{percent:value};const n=Number(d.question_count??d.count??0);const percent=d.percent??d.knowledge_percent;return {key,count:n,percent};});
}
const assessmentLabels={pending_direct:'待直接评分',direct_completed:'直接评分完成',category_pending:'待设置人员类别',unassessed:'未考核',theory_pending:'理论待出分',pending_practical:'待实操评分',completed:'综合评分完成'};
function assessmentStatus(cell){if(isDirectAssessment(cell))return cell.practical_score!=null&&cell.level!=null?'completed':'pending_direct';if(cell.theory_exam_percent!=null&&(cell.theory_item_percent!=null||cell.knowledge_percent!=null)&&!assessmentCategory(cell))return 'category_pending';if(cell.assessment_status&&cell.assessment_status!=='theory_failed')return cell.assessment_status;if(cell.status==='pending_review')return 'theory_pending';if(cell.status==='completed'&&cell.final_percent!=null)return 'completed';if((cell.theory_item_percent!=null||cell.knowledge_percent!=null)&&!assessmentCategory(cell))return 'category_pending';if(cell.theory_item_percent!=null||cell.knowledge_percent!=null)return 'pending_practical';return 'unassessed';}
function assessmentBadge(cell){const status=assessmentStatus(cell);return `<span class="badge ${status==='completed'?'green':['category_pending','theory_pending','pending_practical','pending_direct'].includes(status)?'orange':'gray'}">${esc(t(isDirectAssessment(cell)&&status==='completed'?'直接评分完成':assessmentLabels[status]||'未考核'))}</span>`;}
function matrixEvidence(cell){
  if(isDirectAssessment(cell))return `<details class="matrix-evidence"><summary>${esc(t('查看依据'))}</summary><div class="matrix-evidence-body"><p>${esc(t('按通用矩阵五档直接评分，不需要题库或考试。'))}</p>${cell.practical_reviewed_at?`<p>${esc(t('直接评分时间'))}: ${esc(formatDate(cell.practical_reviewed_at))}</p>`:''}${cell.practical_reviewed_by_name?`<p>${esc(t('评分人'))}: ${esc(cell.practical_reviewed_by_name)}</p>`:''}${cell.practical_note?`<p>${esc(t('评分备注'))}: ${esc(cell.practical_note)}</p>`:''}</div></details>`;
  const count=Number(cell.question_count||cell.pending_question_count||0),evidence=dimensionEvidence(cell),covered=Number(cell.coverage?.dimension_count??evidence.filter(d=>d.count>0).length);
  return `<details class="matrix-evidence"><summary>${esc(t('查看依据'))}</summary><div class="matrix-evidence-body"><p>${esc(t('计分依据'))}: ${esc(compositeFormula(cell))}</p><p>${esc(count)} ${esc(t('题'))} · ${esc(t('维度覆盖'))} ${covered}/${Object.keys(dimensions).length}</p>${evidence.filter(d=>d.count).map(d=>`<div><span>${esc(dimensionLabel(d.key))}</span><strong>${d.percent==null?'—':esc(formatScore(d.percent))}</strong><small>${esc(d.count)} ${esc(t('题'))}</small></div>`).join('')}${cell.practical_reviewed_at?`<p>${esc(t('实操评分时间'))}: ${esc(formatDate(cell.practical_reviewed_at))}</p>`:''}${cell.practical_reviewed_by_name?`<p>${esc(t('评分人'))}: ${esc(cell.practical_reviewed_by_name)}</p>`:''}${cell.practical_note?`<p>${esc(t('评分备注'))}: ${esc(cell.practical_note)}</p>`:''}<p>${esc(t('规则版本'))}: ${esc(cell.rule_version||data.rating_rules?.version||'—')}</p>${cell.practical_assessment_category&&cell.practical_assessment_category!==cell.assessment_category?`<p>${esc(t('当前类别与评分时不同，综合分已按当前类别重新计算。'))}</p>`:''}</div></details>`;
}
function matrixCell(cell){
  const status=assessmentStatus(cell),level=status==='completed'?cell.level:null,title=level==null?t(assessmentLabels[status]||'未考核'):isDirectAssessment(cell)?directLevelLabel(level):compositeLevelLabel(level);
  return `<div class="matrix-mini-cell">${moon(level)}<span>${esc(title)}</span></div>`;
}
function matrixScoreResult(cell){
  const status=assessmentStatus(cell),complete=status==='completed'&&cell.level!=null;
  if(isDirectAssessment(cell))return `<div class="matrix-work-result direct-work-result">${moon(complete?cell.level:null)}<div><small>${esc(t('直接评分等级'))}</small><strong>${esc(complete?directLevelLabel(cell.level):t('待直接评分'))}</strong><span>${esc(t('五档评分'))} <b>${complete?esc(cell.practical_score):'—'}</b> / 5</span></div></div>`;
  return `<div class="matrix-work-result">${moon(complete?cell.level:null)}<div><small>${esc(t('综合能力等级'))}</small><strong>${esc(complete?compositeLevelLabel(cell.level):t(assessmentLabels[status]||'未考核'))}</strong><span>${esc(t('综合分'))} <b>${complete&&cell.final_percent!=null?esc(formatScore(cell.final_percent)):'—'}</b></span></div></div>`;
}
function matrixBlockedReason(cell,employee){
  if(employee?.active===false)return '员工已停用，不能进行现场实操评分。';
  if(!practicalAllowed(cell)&&cell.can_score_practical===false&&cell.theory_exam_percent!=null&&cell.theory_item_percent!=null&&assessmentCategory(cell)&&Number(cell.question_count)>0&&permitted('score_practical'))return '当前项目暂不可评分，请刷新页面确认。';
  return practicalBlockedReason(cell);
}
function matrixScoreRow(item,cell,employee){
  const direct=isDirectAssessment(cell),allowed=employee?.active!==false&&practicalAllowed(cell),key=matrixDraftKey(employee.id,item.id,cell.assignment_id),draft=matrixDrafts.get(key),score=draft?draft.score:(cell.practical_score??null),note=draft?draft.note:(cell.practical_note||'');
  const theory=cell.theory_item_percent??cell.knowledge_percent,saving=matrixSaving.has(key),saveState=matrixSaveStates.get(key),state=saving?t('正在保存…'):draft?t('未保存'):saveState?.saved||cell.practical_score!=null?t('已保存'):'';
  const radios=[1,2,3,4,5].map(value=>`<label class="matrix-score-choice"><input type="radio" name="score" value="${value}" ${Number(score)===value?'checked':''} ${allowed&&!saving?'required':'disabled'} aria-label="${esc(direct?directScoreHint(value):`${t('实操评分')} ${value} / 5`)}"><span>${value}</span></label>`).join('');
  return `<tr class="matrix-work-row"><td data-label="${esc(t('作业项目'))}"><strong class="matrix-work-item">${esc(lang==='id'?(item.name_id||item.name):item.name)}</strong>${matrixEvidence(cell)}${scoreHistoryLink(cell,employee)}</td><td data-label="${esc(t('答题分数'))}">${direct?`<span class="badge green">${esc(t('直接评分'))}</span><p class="direct-mode-label">${esc(t('无需考试'))}</p>`:`<div class="matrix-theory-score"><strong>${theory==null?'—':esc(formatScore(theory))}</strong><span>/ 100</span></div><small class="matrix-theory-evidence">${esc(Number(cell.question_count)||0)} ${esc(t('题'))} · ${esc(Number(cell.coverage?.dimension_count)||0)}/5 ${esc(t('维度覆盖'))}</small>`}</td><td data-label="${esc(t(direct?'直接评分':'现场实操评分'))}"><form class="matrix-score-form" data-employee="${esc(employee.id)}" data-item="${esc(item.id)}" data-assignment="${esc(cell.assignment_id||'')}"><fieldset class="matrix-score-field" ${allowed&&!saving?'':'disabled'}><legend class="sr-only">${esc(item.name)} · ${esc(t(direct?'直接评分':'现场实操评分'))}</legend><div class="matrix-score-choices">${radios}</div></fieldset>${direct?directGuidancePanel(item,score):practicalGuidancePanel(item,score)}<div class="matrix-score-actions"><button type="submit" class="btn primary small" ${allowed&&!saving?'':'disabled'}>${esc(t(saving?'正在保存…':'保存'))}</button><span class="matrix-row-save-state ${draft?'dirty':'saved'}" aria-live="polite">${esc(state)}</span><span class="matrix-score-scale">/ 5</span></div><details class="matrix-score-note" ${draft?.note&&draft.note!==(cell.practical_note||'')?'open':''}><summary>${esc(t('评分备注（选填）'))}</summary><textarea name="note" maxlength="2000" rows="2" aria-label="${esc(t('评分备注（选填）'))}" ${allowed&&!saving?'':'disabled'}>${esc(note)}</textarea></details>${allowed?'':`<p class="matrix-blocked-reason">${esc(t(matrixBlockedReason(cell,employee)))}</p>`}<div class="matrix-score-error form-error" role="alert" ${saveState?.error?'':'hidden'}>${esc(saveState?.error||'')}</div></form></td><td data-label="${esc(t('能力结果'))}">${matrixScoreResult(cell)}</td></tr>`;
}
function renderMatrixContent(){
  const target=$('#matrix-content');if(!target||!matrix||matrixScope!==matrixCurrentScope())return;
  const focus=captureContentFocus(target);
  ensureMatrixScoringScope();
  const rows=sortAssessmentEmployeeRows(Array.isArray(matrix.rows)?matrix.rows:[]),items=Array.isArray(matrix.items)?matrix.items:[];
  const controls=$('#matrix-scoring-controls');if(controls)controls.innerHTML=matrixScoringControls();
  const employeeSelect=$('[data-filter="matrix_employee"]');if(employeeSelect){employeeSelect.innerHTML=matrixEmployeeOptions(rows);employeeSelect.disabled=!rows.length||matrixScoringMode==='multi';const label=employeeSelect.closest?.('label');if(label)label.hidden=matrixScoringMode==='multi';}
  if(!items.length||!rows.length){target.innerHTML=matrixEmpty(!items.length?'本岗位还没有作业项目':'本岗位还没有员工');return;}
  const selected=rows.find(row=>row.employee?.id===filters.employee_id);
  let workspace=matrixEmpty('请先选择员工');
  if(matrixScoringMode==='multi')workspace=matrixMultiWorkspace(items);
  else if(selected){
    const cells=selected.cells||[],hasExamItems=items.some(item=>!isDirectAssessment(item)),theoryCell=cells.find(cell=>!isDirectAssessment(cell)&&cell.theory_exam_percent!=null),theory=selected.theory_exam_percent??theoryCell?.theory_exam_percent;
    const categoryValue={...selected.employee,...selected,assessment_category:selected.assessment_category||selected.employee.assessment_category||theoryCell?.assessment_category||''};
    const gate=theory==null?t('理论待出分'):t('可进行实操评分');
    const gateGood=theory!=null;
    const facts=hasExamItems?`<div class="matrix-person-facts"><span>${esc(t('考试与实操'))} · ${esc(t('当前权重'))}<strong>${esc(weightsLabel(categoryValue))}</strong></span><span>${esc(t('理论总分'))}<strong>${theory==null?'—':esc(formatScore(theory))} / 100 <small class="${gateGood?'gate-pass':'gate-fail'}">${esc(gate)}</small></strong></span></div>`:`<div class="matrix-person-facts"><span>${esc(t('直接评分'))}<strong>${esc(t('无需考试'))}</strong></span></div>`;
    const groups=assessmentItemGroups(items).map(group=>`<tr class="matrix-skill-group"><td colspan="4"><strong>${esc(t(group.label))}</strong><span>${esc(group.items.length)} ${esc(t('项'))} · ${esc(t((group.key==='exam'||group.key.startsWith('custom:exam_practical:'))?'考试与实操':'直接评分'))}</span></td></tr>${group.items.map(item=>matrixScoreRow(item,scoringCell(item,cells.find(cell=>cell.work_item_id===item.id)),selected.employee)).join('')}`).join('');
    workspace=`<section class="panel matrix-workspace-panel"><div class="matrix-person-heading"><div><h2>${esc(selected.employee.name)}</h2><span>${esc(selected.employee.employee_no||'')}</span>${hasExamItems?`<span class="matrix-person-category">${esc(categoryLabel(categoryValue,true))}</span>`:''}${employeeScoringProgressMarkup(selected,items)}</div>${facts}</div><div class="table-wrap matrix-work-table-wrap"><table class="matrix-work-table"><thead><tr><th>${esc(t('作业项目'))}</th><th>${esc(t('答题分数'))}</th><th>${esc(t('现场实操评分'))} <span>1–5</span></th><th>${esc(t('能力结果'))}</th></tr></thead><tbody>${groups}</tbody></table></div><p class="matrix-workbench-foot">${esc(t('点检、数据等技能直接评分；考试作业按理论与实操加权。'))}</p>${practicalBulkBar(selected,'matrix')}</section>`;
  }
  const matrixGrid=`<details class="panel matrix-overview"><summary><span>${icon('grid')}<strong>${esc(t('车间能力月亮图'))}</strong><small>${esc(rows.length)} ${esc(t('人'))}</small></span><span class="matrix-overview-hint">${esc(t('查看'))} ›</span></summary><p class="matrix-overview-description">${esc(t('月亮图仅展示已保存的评分结果。'))}</p><div class="table-wrap"><table class="matrix-table matrix-summary-table"><thead><tr><th>${esc(t('作业项目'))} / ${esc(t('员工'))}</th>${rows.map(row=>`<th>${esc(row.employee?.name||'—')}<span class="cell-sub">${esc(row.employee?.employee_no||'')}</span></th>`).join('')}</tr></thead><tbody>${items.map(item=>`<tr><td><strong>${esc(lang==='id'?(item.name_id||item.name):item.name)}</strong></td>${rows.map(row=>`<td>${matrixCell(scoringCell(item,(row.cells||[]).find(cell=>cell.work_item_id===item.id)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="legend"><span>${moon(null)}${esc(t('未考核'))}</span>${levels.map((lv,i)=>`<span>${moon(i)}${esc(compositeLevelLabel(i))}</span>`).join('')}</div></details>`;
  target.innerHTML=`${matrixNotice?`<div class="notice warning" role="alert">${esc(matrixNotice)}</div>`:''}${workspace}${matrixGrid}`;
  restoreContentFocus(target,focus);
}
async function loadMatrix({quiet=false,persisted=false}={}){
  if(!filters.position_id||!filters.workshop_id)return false;const positionId=filters.position_id,workshopId=filters.workshop_id,scope=matrixCurrentScope(),request=++matrixRequest;
  captureMatrixDrafts();const target=$('#matrix-content');if(target&&!quiet)target.innerHTML=matrixLoading();
  try{
    const result=await api('/api/matrix?position_id='+encodeURIComponent(positionId)+'&workshop_id='+encodeURIComponent(workshopId));
    if(route!=='matrix'||matrixCurrentScope()!==scope||request!==matrixRequest)return false;
    matrix=result;matrixScope=scope;ensureMatrixScoringScope();restorePracticalDrafts(result);
    const validIds=new Set((result.rows||[]).map(row=>row.employee.id));
    for(const id of matrixExportSelection)if(!validIds.has(id))matrixExportSelection.delete(id);
    for(const id of matrixScoringSelection)if(!validIds.has(id))matrixScoringSelection.delete(id);
    if(filters.employee_id&&!validIds.has(filters.employee_id))filters.employee_id='';
    renderMatrixContent();return true;
  }catch(e){if(route==='matrix'&&matrixCurrentScope()===scope&&request===matrixRequest){if(quiet&&matrix){matrixNotice=persisted?t('已保存，结果加载失败，请刷新页面。'):t('加载失败')+': '+e.message;renderMatrixContent();}else if($('#matrix-content'))$('#matrix-content').innerHTML=`<section class="panel"><div class="empty"><h3>${esc(t('加载失败'))}</h3><p>${esc(e.message)}</p></div></section>`;}return false;}
}
async function submitMatrixPractical(form){if(form?.classList?.contains('matrix-multi-score-cell'))return;return savePracticalScores('matrix',form);}
function highlightSavedMatrixScore(employee,item,assignment){
  const form=$$('.matrix-score-form').find(form=>form.dataset.employee===employee&&form.dataset.item===item&&form.dataset.assignment===assignment);
  const row=form?.closest?.('.matrix-work-row');if(!row)return;
  row.classList.add('score-just-saved');setTimeout(()=>row.classList.remove('score-just-saved'),650);
}
function openMatrixEmployeeExport(){
  if(!filters.workshop_id||!filters.position_id||matrixScope!==matrixCurrentScope()){toast(t('按车间和岗位筛选后可选择员工导出。'));return;}
  const rows=sortAssessmentEmployeeRows(matrix?.rows||[]);if(!rows.length){toast(t('本岗位还没有员工'));return;}
  if(!matrixExportSeeded){if(rows.some(row=>row.employee.id===filters.employee_id))matrixExportSelection.add(filters.employee_id);matrixExportSeeded=true;}
  const scope=matrixCurrentScope(),workshopId=filters.workshop_id,positionId=filters.position_id;
  const body=`<div class="matrix-export-context"><strong>${esc(nameOf('workshops',workshopId))}</strong><span>${esc(nameOf('positions',positionId))}</span></div><div class="matrix-export-tools">${btn('matrix-export-all','全选','','secondary small','')}${btn('matrix-export-clear','清空','','secondary small','')}<span id="matrix-export-count"></span></div><div class="matrix-export-list">${rows.map(row=>`<label><input type="checkbox" data-matrix-export-employee value="${esc(row.employee.id)}" ${matrixExportSelection.has(row.employee.id)?'checked':''}><span><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employee_no||'')}</small></span></label>`).join('')}</div>`;
  openEditor('按原始模板导出所选员工','勾选需要导出的员工，可多选。',body,async()=>{
    if(matrixCurrentScope()!==scope)throw new Error(t('按车间和岗位筛选后可选择员工导出。'));
    const visible=new Set(rows.map(row=>row.employee.id)),ids=[...matrixExportSelection].filter(id=>visible.has(id));
    if(!ids.length)throw new Error(t('至少选择一名员工'));
    if(await downloadSelectedMatrix(workshopId,positionId,ids))closeEditor();
  },'导出所选员工');updateMatrixExportSelection();
}
function setMatrixExportSelection(all){$$('[data-matrix-export-employee]').forEach(input=>{input.checked=all;if(all)matrixExportSelection.add(input.value);else matrixExportSelection.delete(input.value);});updateMatrixExportSelection();}
function updateMatrixExportSelection(){const count=$('#matrix-export-count');if(count)count.textContent=`${t('已选择')} ${matrixExportSelection.size} ${t('人')}`;if($('#editor-save'))$('#editor-save').disabled=matrixExportSelection.size===0;}
async function downloadSelectedMatrix(workshopId,positionId,ids){
  const query=new URLSearchParams({workshop_id:workshopId,position_id:positionId,employee_ids:ids.join(',')});
  return downloadMatrixAttachment('/api/export/matrix.xlsx?'+query.toString());
}

function field(name,label,value='',type='text',extra=''){return `<label class="field"><span>${esc(t(label))}${extra.includes('required')?' *':''}</span><input type="${esc(type)}" name="${esc(name)}" value="${esc(value)}" ${extra}></label>`;}
function textarea(name,label,value='',extra=''){return `<label class="field"><span>${esc(t(label))}${extra.includes('required')?' *':''}</span><textarea name="${esc(name)}" ${extra}>${esc(value)}</textarea></label>`;}
function selectField(name,label,options,extra=''){return `<label class="field"><span>${esc(t(label))}${extra.includes('required')?' *':''}</span><select name="${esc(name)}" aria-label="${esc(t(label))}" ${extra}>${options}</select></label>`;}
function checkbox(name,label,checked=true){return `<label class="checkbox-field"><input type="checkbox" name="${esc(name)}" ${checked?'checked':''}>${esc(t(label))}</label>`;}
function openEditor(title,description,body,submit,saveLabel='保存'){editorSubmit=submit;$('#editor-body').innerHTML=`<h2 class="dialog-title">${esc(t(title))}</h2><p class="dialog-desc">${esc(t(description))}</p>${body}<div id="editor-error" hidden class="form-error"></div>`;$('#editor-save').textContent=t(saveLabel);$('#editor-save').hidden=!submit;$('#editor-form .dialog-actions button:first-child').textContent=t(submit?'取消':'关闭');$('#editor').showModal();}
function closeEditor(){$('#editor').close();editorSubmit=null;refreshManagementConfiguration();}
function positionDepartmentFields(major,workshopId=''){
  const support=isSupportMajor(major),legacy=major==='__legacy__';if(!support&&!legacy)return '';
  const own=departmentSelfService()?data.user.workshop_id:'',selected=own||workshopId,workshops=list('workshops').filter(w=>(!support||isSupportMajor(w.major_workshop_id))&&(!own||w.id===own));
  return `${selectField(own?'position_workshop_display':'workshop_id',support?'所属二线部门':'所属车间',option('',t('请选择'),selected)+workshops.map(w=>option(w.id,bilingualEntryName(w),selected)).join(''),`required ${own?'disabled':''}`)}${own?`<input type="hidden" name="workshop_id" value="${esc(own)}">`:''}<p class="security-note">${esc(t(support?'二线部门的岗位和题库仅供所选部门使用。':'该岗位仅供所选车间使用。'))}</p>`;
}
function positionScopeFields(position={}){
  const own=departmentSelfService()?ownMajorId():'',inferred=majorIdForPosition(position),legacy=position.workshop_id&&!position.major_workshop_id&&!isSupportMajor(inferred),major=own||(legacy?'__legacy__':inferred||filters.major_workshop_id||ownMajorId());
  return selectField(own?'position_major_display':'major_workshop_id','所属大车间',majorSelectOptions(major,'请选择',legacy),`required data-dependent="position-major" ${own?'disabled':''}`)+(own?`<input type="hidden" name="major_workshop_id" value="${esc(major)}">`:'')+`<div id="position-department-fields">${positionDepartmentFields(major,position.workshop_id)}</div>`;
}
function updatePositionScope(){const form=$('#editor-form'),target=$('#position-department-fields');if(form&&target)target.innerHTML=positionDepartmentFields(form.elements.major_workshop_id?.value,form.elements.workshop_id?.value||'');}
function readPositionScope(form,payload){
  const major=form.elements.major_workshop_id?.value||'',workshopId=form.elements.workshop_id?.value||'',workshop=find('workshops',workshopId);
  if(!visibleMajors().some(row=>row.id===major)&&major!=='__legacy__')throw new Error(t('请选择有权限的大车间'));
  if(isSupportMajor(major)||major==='__legacy__'){
    if(!workshop||isSupportMajor(major)&&!isSupportMajor(workshop.major_workshop_id)||departmentSelfService()&&workshopId!==data.user.workshop_id)throw new Error(t('请选择本部门。'));
    payload.major_workshop_id='';payload.workshop_id=workshopId;
  }else{if(departmentSelfService()&&major!==ownMajorId())throw new Error(t('请选择本部门。'));payload.major_workshop_id=major;payload.workshop_id='';}
}
function openEntityEditor(collection,id){const r=id?find(collection,id):{};if(!r||(id?!canEdit(collection,r):!canWrite(collection)))return;if(collection==='questions'&&!id&&questionPrerequisiteMissing()){toast(t(questionSetupState()?.message||'请先选择岗位和作业题库。'));return;}const isNew=!id,sharedBinding=collection==='work_items'&&hasQuestionBankCatalog()&&!isDirectAssessment(r)&&find('question_banks',r.question_bank_id);if(collection==='questions'&&hasQuestionBankCatalog()&&r.merged_into_question_id){openViewQuestion(id);return;}let body='';const statusOptions=Object.keys(statuses).slice(0,3).map(k=>option(k,t(statuses[k]),r.status||'draft')).join('');const posOptions=selectOptions('positions',r.position_id||filters.position_id);const workshopOptions=selectOptions('workshops',r.workshop_id||filters.workshop_id||(data.user.role==='workshop_admin'?data.user.workshop_id:''));switch(collection){case'workshops':body=field('name','车间名称（中文）',r.name,'text','required maxlength="100"')+field('name_id','车间名称（印尼文）',r.name_id,'text',`maxlength="160" ${isNew||r.major_workshop_id?'required':''}`)+selectField('major_workshop_id','所属大车间',majorSelectOptions(r.major_workshop_id||''),isNew?'required':'')+`<div class="field-row">${field('code','编号',r.code,'text','maxlength="60"')}${field('manager','负责人',r.manager,'text','maxlength="100"')}</div>`+textarea('description','说明',r.description,'maxlength="2000"');break;case'positions':body=field('name','岗位名称（中文）',r.name,'text','required maxlength="100"')+field('name_id','岗位名称（印尼文）',r.name_id,'text','maxlength="160" required')+positionScopeFields(r)+textarea('description','说明',r.description,'maxlength="2000"');break;case'work_items':body=`<div class="field-row">${field('name','名称',r.name,'text','required maxlength="160"')}${field('name_id','印尼文名称',r.name_id,'text','maxlength="160"')}</div>`+selectField('position_id','所属岗位',posOptions,'required data-dependent="work-item-position"')+`<div class="field-row">${workCategoryFields(r,r.position_id||filters.position_id)}${selectField('assessment_mode','考核方式',option('exam_practical',t('考试与实操'),r.assessment_mode||'exam_practical')+option('direct',t('直接评分'),r.assessment_mode||'exam_practical'),'required data-dependent="assessment-mode"')}</div><p id="work-item-mode-help" class="security-note">${esc(t(isDirectAssessment(r)?'直接评分项目不录入题目。':'考试作业需理论与实操；直接评分项目无需考试。'))}</p>`+textarea('description','说明',r.description,'maxlength="3000"')+textarea('practical_standard_zh','实操考核要点（中文）',r.practical_standard_zh,'maxlength="3000"')+textarea('practical_standard_id','实操考核要点（印尼文）',r.practical_standard_id,'maxlength="3000"')+field('sort_order','排序',r.sort_order??0,'number','step="1" min="0" max="99999"')+checkbox('active','启用',r.active!==false);break;case'employees':body=`<div class="field-row">${field('employee_no','员工编号',r.employee_no,'text','required maxlength="80"')}${field('name','员工姓名',r.name,'text','required maxlength="100"')}</div>`+selectField('workshop_id','所属车间',workshopOptions,'required data-dependent="employee-workshop"')+selectField('position_id','所属岗位',posOptions,'required data-dependent="employee-position"')+`<p class="security-note">${esc(t('编号车间用于人员与考试范围，岗位来自对应大车间的共用题库。'))}</p>`+selectField('assessment_category','人员类别',employeeAssessmentCategoryOptions(r.position_id,r.assessment_category||''),'required data-dependent="employee-category" aria-describedby="employee-category-help"')+`<p class="security-note" id="employee-category-help">${employeeAssessmentCategoryHelp(r.position_id)}</p>`+selectField('language','答题语言',option('zh',t('中文'),r.language||'zh')+option('id',t('印尼文'),r.language||'zh'))+checkbox('active','启用员工',r.active!==false)+`<p class="security-note">${esc(t('工号请在全公司范围内保持唯一。'))}</p>`;break;case'plans':body=field('title','考试名称',r.title,'text','required maxlength="160"')+selectField('position_id','所属岗位',posOptions,'required data-dependent="plan-position"')+`<div class="field-row">${field('question_count','题量上限',50,'number','required readonly min="50" max="50" step="1"')}${field('duration_minutes','考试时长（分钟）',r.duration_minutes??30,'number','required min="1" max="480" step="1"')}</div>`+field('pass_score','及格线（百分制）',r.pass_score??60,'number','required min="0" max="100" step="0.1"')+selectField('status','发布状态',statusOptions)+`<div class="notice" id="plan-pool-info">${esc(t('每场最多50题，不足时按实际题数考试；按作业项目和评价维度均衡抽题，每题等分，折算100分。'))}</div>`;break;case'users':body=`<div class="field-row">${field('username','登录名',r.username,'text',`required maxlength="100" ${isNew?'':'readonly'}`)}${field('name','显示名称',r.name,'text','required maxlength="100"')}</div>`+field('password',isNew?'新账号密码':'重置密码（留空不变）','','password',`autocomplete="new-password" ${isNew?'required':''}`)+selectField('role','角色',Object.entries(roles).map(([v,label])=>option(v,t(label),r.role||'viewer')).join(''),'required data-dependent="user-role"')+selectField('workshop_id','所属车间',workshopOptions)+checkbox('active','启用',r.active!==false)+`<p class="security-note">${esc(t('车间管理员、题库编辑员和车间精益员必须指定所属车间。'))}</p>`;break;case'questions':body=questionForm(r);break;}
if(sharedBinding){
  body=`<div class="notice">${esc(t('该岗位使用共用题库，此处仅调整启用状态、排序和实操要点。'))}</div>`+body;
  body=body.replace(/(<input[^>]*name="(?:name|name_id)"[^>]*)(>)/g,'$1 readonly$2');
  for(const [key,value] of [['position_id',r.position_id],['assessment_mode',r.assessment_mode||'exam_practical']])body=body.replace(new RegExp('(<select[^>]*name=")'+key+'("[^>]*)(>)'),'$1'+key+'_display$2 disabled$3')+`<input type="hidden" name="${key}" value="${esc(value)}">`;
}
const currentRoute=Object.keys(cfg).find(k=>cfg[k].collection===collection),editorContext={epoch:managementEpoch,authority:managementAuthority(data),route};openEditor(`${t(isNew?'新建':'编辑')} · ${t(routeNames[currentRoute]||'')}`,collection==='questions'&&data.user?.role==='question_contributor'?'保存为草稿后，可编辑并启用自己提交的题目。':'保存后可在列表中查看和修改。',body,async(form)=>{if(editorContext.epoch!==managementEpoch||editorContext.authority!==managementAuthority(data)||editorContext.route!==route||$('#editor-form')!==form||!$('#editor')?.open||(id?!canEdit(collection,find(collection,id)):!canWrite(collection)))throw new Error(t('权限或配置已变化，请重新打开后保存。'));let payload=Object.fromEntries(new FormData(form));if(collection==='positions')readPositionScope(form,payload);if(['work_items','employees','users'].includes(collection))payload.active=form.elements.active.checked;if(collection==='employees'){payload.assessment_category=positionAssessmentCategory(payload.position_id,payload.assessment_category,list('positions'));if(!assessmentCategory(payload.assessment_category))throw new Error(t('请选择人员类别'));}if(collection==='work_items'){payload.sort_order=Number(payload.sort_order||0);readWorkCategoryBinding(form,payload);}if(collection==='plans'){payload.question_count=50;payload.duration_minutes=Number(payload.duration_minutes);payload.pass_score=Number(payload.pass_score);}if(collection==='questions'){payload=readQuestionForm(form);if(payload.status==='active'&&(!payload.title_zh||!payload.title_id||payload.options.some(o=>!o.text_zh||!o.text_id))&&!form.dataset.monolingualConfirmed){form.dataset.monolingualConfirmed='true';throw new Error(t('单语题目启用后，另一语言将显示现有内容；请补全中印双语后用于正式考试。')+' '+(lang==='id'?'Tekan Simpan lagi untuk mengonfirmasi.':'再次点击保存确认启用。'));}}if(collection==='users'){if(!payload.password)delete payload.password;if(['workshop_admin','question_editor','question_contributor'].includes(payload.role)&&!payload.workshop_id)throw new Error(t('车间管理员、题库编辑员和车间精益员必须指定所属车间。'));if(!payload.workshop_id)payload.workshop_id=null;}await api(`/api/${collection}${id?'/'+encodeURIComponent(id):''}`,{method:id?'PUT':'POST',body:payload});closeEditor();await refresh();toast(t('保存成功'));});if(collection==='work_items')updateWorkCategoryChoices();if(collection==='employees')updateDependentPositions();if(collection==='plans')updatePlanPool();if(collection==='questions')updateQuestionType();}
function questionHierarchyFields(r){
  if(hasQuestionBankCatalog()){
    const item=find('work_items',r.work_item_id||r.source_work_item_id),candidate=find('question_banks',filters.question_bank_id||selectedQuestionWorkItemFilter()?.value),bank=bankOfQuestion(r)||(candidate&&(!filters.position_id||bankPositionId(candidate)===filters.position_id)&&bankMatchesMajor(candidate,filters.major_workshop_id)?candidate:null)||find('question_banks',item?.question_bank_id),positionId=bankPositionId(bank)||item?.position_id||filters.position_id||'',position=find('positions',positionId),major=bank?(bankMajorId(bank)||'__legacy__'):position?(majorIdForPosition(position)||'__legacy__'):filters.major_workshop_id||ownMajorId()||(visibleMajors().length===1?visibleMajors()[0].id:'');
    const locked=Boolean(r.id),origin=r.work_item_id||r.source_work_item_id||questionBankItem(bank,positionId)?.id||'';
    return `<div class="field-row">${selectField('question_major_workshop_id','大车间',majorSelectOptions(major,'请选择',true),`required data-dependent="question-major" ${locked?'disabled':''}`)}${selectField('question_position_id','所属岗位',positionOptions(positionId,'请选择',row=>Boolean(major)&&positionMatchesMajor(row,major)),`required data-dependent="question-position" ${locked?'disabled':''}`)}</div>${selectField('question_bank_id','作业题库',questionBankOptions(bank?.id||'',major,locked,positionId),`required data-dependent="question-bank" ${locked?'disabled':''}`)}${locked?`<input type="hidden" name="question_bank_id" value="${esc(bank?.id||'')}"><input type="hidden" name="question_major_workshop_id" value="${esc(major)}"><input type="hidden" name="question_position_id" value="${esc(positionId)}">`:''}<input type="hidden" name="work_item_id" value="${esc(origin)}"><input type="hidden" name="source_question_id" value="${esc(r.id||'')}"><div id="question-bank-scope">${questionBankScopeNotice(bank)}</div>`;
  }
  const item=find('work_items',r.work_item_id||filters.work_item_id),positionId=item?.position_id||filters.position_id||'',position=find('positions',positionId);
  const major=position?(majorIdForPosition(position)||'__legacy__'):filters.major_workshop_id||ownMajorId()||(visibleMajors().length===1?visibleMajors()[0].id:'');
  return `<div class="field-row">${selectField('question_major_workshop_id','大车间',majorSelectOptions(major,'请选择',true),'required data-dependent="question-major"')}${selectField('question_position_id','所属岗位',positionOptions(positionId,'请选择',p=>Boolean(major)&&positionMatchesMajor(p,major)),'required data-dependent="question-position"')}</div>`+selectField('work_item_id','所属作业项目',selectOptions('work_items',item?.id||'','请选择',item=>item.position_id===positionId&&!isDirectAssessment(item)),'required');
}
function updateQuestionHierarchy(){const form=$('#editor-form');
  if(hasQuestionBankCatalog()){
    const major=form.elements.question_major_workshop_id?.value,position=form.elements.question_position_id,select=form.elements.question_bank_id,item=form.elements.work_item_id;if(!position||!select||!item||form.elements.source_question_id?.value)return;
    const previousPosition=position.value,previous=select.value;position.innerHTML=positionOptions(previousPosition,'请选择',row=>Boolean(major)&&positionMatchesMajor(row,major));select.innerHTML=questionBankOptions(previous,major,false,position.value);const bank=find('question_banks',select.value);item.value=questionBankItem(bank,position.value)?.id||'';const hint=$('#question-bank-scope');if(hint)hint.innerHTML=questionBankScopeNotice(bank);return;
  }
  const major=form.elements.question_major_workshop_id?.value,position=form.elements.question_position_id,item=form.elements.work_item_id;if(!position||!item)return;const previousPosition=position.value,previousItem=item.value;position.innerHTML=positionOptions(previousPosition,'请选择',row=>Boolean(major)&&positionMatchesMajor(row,major));item.innerHTML=selectOptions('work_items',previousItem,'请选择',row=>row.position_id===position.value&&!isDirectAssessment(row));
}
function questionForm(r){return `<p class="notice">${esc(t('原题分值仅保留来源记录；新考试每题等分，折算100分。'))}</p>`+questionHierarchyFields(r)+selectField('dimension','评价维度',Object.entries(dimensions).map(([key,label])=>option(key,dimensionLabel(key),r.dimension||'knowledge')).join(''),'required')+`<div class="field-row">${selectField('type','题型',Object.entries(types).filter(([v])=>v!=='essay').map(([v,l])=>option(v,t(l),r.type||'single')).join(''),'required data-dependent="question-type"')}${field('points','原题分值',r.points??2,'number','required min="0.1" max="1000" step="0.1"')}</div>`+textarea('title_zh','中文题目',r.title_zh,'maxlength="10000"')+textarea('title_id','印尼文题目',r.title_id,'maxlength="10000"')+`<div id="choice-fields" class="question-options"><div class="note-label">${esc(t('选项'))}</div><div id="question-option-rows">${(r.options?.length?r.options:[{key:'A'},{key:'B'},{key:'C'},{key:'D'}]).map(o=>optionEditor(o,(r.correct_answer||[]).includes(o.key),r.type||'single')).join('')}</div>${btn('add-option','增加选项','','secondary small','plus')}<small class="security-note" style="display:block">${esc(t('至少填写两个选项。多选题需要选择全部正确选项。'))}</small></div><div id="boolean-fields" class="question-options"><div class="note-label">${esc(t('标准答案'))}</div><div class="answer-keys"><label><input type="radio" name="boolean_answer" value="true" ${(r.correct_answer||[]).includes('true')?'checked':''}> ${esc(t('正确'))}</label><label><input type="radio" name="boolean_answer" value="false" ${(r.correct_answer||[]).includes('false')?'checked':''}> ${esc(t('错误'))}</label></div></div><div id="essay-fields">${textarea('reference_answer_zh','中文参考答案',r.reference_answer_zh,'maxlength="10000"')}${textarea('reference_answer_id','印尼文参考答案',r.reference_answer_id,'maxlength="10000"')}<p class="security-note">${esc(t('简答题提交后需要管理员人工评分。'))}</p></div>`+selectField('status','发布状态',Object.keys(statuses).slice(0,3).map(k=>option(k,t(statuses[k]),r.status||'draft')).join(''))+`<p class="security-note">${esc(t('答案只对有题库编辑权限的人员可见；员工答题不展示答案。'))}</p>`;}
function optionEditor(o,checked=false,type='single'){return `<div class="option-editor" data-key="${esc(o.key)}"><span class="option-letter">${esc(o.key)}</span><input class="option-zh" value="${esc(o.text_zh||'')}" placeholder="${esc(t('中文选项'))}" maxlength="2000" aria-label="${esc(o.key+' '+t('中文选项'))}"><input class="option-id" value="${esc(o.text_id||'')}" placeholder="${esc(t('印尼文选项'))}" maxlength="2000" aria-label="${esc(o.key+' '+t('印尼文选项'))}"><button type="button" class="btn link option-remove" data-action="remove-option" aria-label="${esc(t('删除'))}">×</button><label class="answer-keys" style="grid-column:2 / -1;margin:0 0 7px"><input type="${type==='multiple'?'checkbox':'radio'}" name="choice_correct" value="${esc(o.key)}" ${checked?'checked':''}>${esc(t('标准答案'))} ${esc(o.key)}</label></div>`;}
function updateQuestionType(){const form=$('#editor-form');if(!form.elements.type)return;const type=form.elements.type.value;$('#choice-fields').hidden=!['single','multiple'].includes(type);$('#boolean-fields').hidden=type!=='true_false';$('#essay-fields').hidden=type!=='essay';$$('[name="choice_correct"]',form).forEach((inp,i)=>{inp.type=type==='multiple'?'checkbox':'radio';if(type==='single'&&i>0&&inp.checked){const first=$$('[name="choice_correct"]:checked',form)[0];if(first!==inp)inp.checked=false;}});}
function readQuestionForm(form){const f=new FormData(form);let bankPayload={};if(hasQuestionBankCatalog()){
    const bank=find('question_banks',f.get('question_bank_id')),origin=find('work_items',f.get('work_item_id')),existing=f.get('source_question_id')?find('questions',f.get('source_question_id')):null;
    if(!bank||!origin||!f.get('question_major_workshop_id')||!bankMatchesMajor(bank,f.get('question_major_workshop_id'))||!bankPositionId(bank)||bankPositionId(bank)!==f.get('question_position_id')||origin.position_id!==f.get('question_position_id')||bankMajorId(bank)!==majorIdForPosition(find('positions',origin.position_id))||origin.question_bank_id!==bank.id||!visibleQuestionBanks({position_id:f.get('question_position_id')}).some(row=>row.id===bank.id))throw new Error(t('题库或岗位配置已更新，请重新打开后再保存。'));
    if(existing&&(String(existing.work_item_id||existing.source_work_item_id)!==String(origin.id)||bankOfQuestion(existing)?.id!==bank.id))throw new Error(t('已有题目不能移动题库；请在原题库中维护。'));
    if(!existing&&(bank.active===false||!questionPositionIds({question_bank_id:bank.id}).length||origin.active===false||origin.id!==questionBankItem(bank)?.id))throw new Error(t('题库或岗位配置已更新，请重新打开后再保存。'));
    if(existing?.merged_into_question_id)throw new Error(t('已归并，历史只读'));
    bankPayload={question_bank_id:bank.id,position_id:bankPositionId(bank)};
  }const type=f.get('type');if(isDirectAssessment(find('work_items',f.get('work_item_id'))))throw new Error(t('该项目为直接评分，不接受题目。'));if(!['single','multiple','true_false'].includes(type))throw new Error(t('仅支持单选、多选、判断题。'));if(!String(f.get('title_zh')||'').trim()&&!String(f.get('title_id')||'').trim())throw new Error(lang==='id'?'Isi soal dalam setidaknya satu bahasa.':'请至少填写一种语言的题目。');let options=[],answer=[];if(['single','multiple'].includes(type)){options=$$('.option-editor',form).map(row=>({key:row.dataset.key,text_zh:$('.option-zh',row).value.trim(),text_id:$('.option-id',row).value.trim()})).filter(o=>o.text_zh||o.text_id);if(options.length<2)throw new Error(t('至少填写两个选项。多选题需要选择全部正确选项。'));const allowed=new Set(options.map(o=>o.key));answer=f.getAll('choice_correct').filter(k=>allowed.has(k));if(!answer.length||(type==='single'&&answer.length!==1))throw new Error(t('请选择')+' '+t('标准答案'));}if(type==='true_false'){const key=f.get('boolean_answer');if(!key)throw new Error(t('请选择')+' '+t('标准答案'));options=[{key:'true',text_zh:'正确',text_id:'Benar'},{key:'false',text_zh:'错误',text_id:'Salah'}];answer=[key];}return{...bankPayload,work_item_id:f.get('work_item_id'),dimension:f.get('dimension'),type,title_zh:String(f.get('title_zh')||'').trim(),title_id:String(f.get('title_id')||'').trim(),options,correct_answer:answer,reference_answer_zh:type==='essay'?String(f.get('reference_answer_zh')||''):'',reference_answer_id:type==='essay'?String(f.get('reference_answer_id')||''):'',points:Number(f.get('points')),status:f.get('status')};}
function updateDependentPositions(){const form=$('#editor-form');const workshop=form.elements.workshop_id?.value;const select=form.elements.position_id;if(!select)return;const current=select.value;select.innerHTML=positionOptions(current,'请选择',p=>positionMatchesWorkshop(p,workshop));updateEmployeeAssessmentCategory();}
function updatePlanPool(){const pos=$('#editor-form').elements.position_id?.value;const el=$('#plan-pool-info');if(!el)return;const available=availableQuestions(pos);el.className='notice'+(available?'':' warning');el.textContent=`${t('实际题数')}: ${Math.min(50,available)} · ${t('可用题目')}: ${available}. ${t('每场最多50题，不足时按实际题数考试；按作业项目和评价维度均衡抽题，每题等分，折算100分。')}`;}
function openDelete(collection,id){if(!canDelete(collection))return;openEditor('删除记录','删除后无法在界面撤销；存在关联记录时，系统会阻止删除。',`<div class="notice warning">${esc(t('确认删除这条记录？'))}</div>`,async()=>{await api(`/api/${collection}/${encodeURIComponent(id)}`,{method:'DELETE'});closeEditor();await refresh();toast(t('删除成功'));},'确定删除');}
async function openDeleteExamRecord(id){
  const original=find('assignments',id),profile=find('employees',original?.employee_id);
  if(route!=='results'||!canDeleteExamRecord(original)||!profile)return;
  const assignment={...original},employee={...profile};
  const authority=managementAuthority(data),epoch=managementEpoch;
  const unchanged=()=>epoch===managementEpoch&&authority===managementAuthority(data)&&route==='results';
  const sameRecord=value=>canDeleteExamRecord(value)&&['id','employee_id','plan_id','round_id','created_at','status','started_at','submitted_at','percent'].every(key=>(value[key]??null)===(assignment[key]??null));
  const sameEmployee=value=>value&&['id','name','employee_no','workshop_id','position_id'].every(key=>(value[key]??null)===(employee[key]??null));
  const identity=`<div class="notice warning">${esc(t('请核对姓名和完整工号。'))}</div><div class="details-card"><p><strong>${esc(t('员工姓名'))}</strong>：${esc(employee.name)}</p><p><strong>${esc(t('工号'))}</strong>：${esc(employee.employee_no)}</p><p><strong>${esc(t('考试名称'))}</strong>：${esc(find('plans',assignment.plan_id)?.title||assignment.plan_title||'—')}</p><p><strong>${esc(t('考试状态'))}</strong>：${esc(t(statuses[assignment.status]))}</p></div>`;
  // The unique submit identity also owns the read-only loading dialog. Closing,
  // navigation, another dialog or a session change makes its response obsolete.
  const loading=async()=>{throw new Error(t('正在核对删除影响…'));};
  openEditor('删除考试记录','正在核对删除影响…',identity,null);editorSubmit=loading;
  const currentLoading=()=>unchanged()&&editorSubmit===loading&&$('#editor')?.open;
  let preview;
  try{preview=await api(`/api/assignments/${encodeURIComponent(id)}/delete-preview`,{}, {epoch,isCurrent:currentLoading});}
  catch(error){if(currentLoading())openEditor('删除考试记录','删除影响读取失败，请关闭后重新操作。',identity+`<p class="form-error">${esc(error.message)}</p>`,null);return;}
  if(!currentLoading())return;
  if(!sameRecord(find('assignments',id))||!sameRecord(preview?.assignment)||!sameEmployee(find('employees',employee.id))||!sameEmployee(preview?.employee)||typeof preview?.version!=='string'||!/^[a-f0-9]{64}$/.test(preview.version)||!Number.isSafeInteger(preview.practical_score_count)||preview.practical_score_count<0){
    openEditor('删除考试记录','考试或记录已变化，无法删除，请刷新列表。',identity,null);return;
  }
  const submit=async form=>{
    if(!unchanged()||editorSubmit!==submit)throw new Error(t('记录或登录状态已变化，请刷新后重新操作。'));
    if(form?.elements?.confirm_exam_delete?.checked!==true)throw new Error(t('请先勾选确认删除。'));
    if(!sameRecord(find('assignments',id))||!sameEmployee(find('employees',employee.id)))throw new Error(t('考试或记录已变化，无法删除，请刷新列表。'));
    // The server compares the exact exam, employee and associated score rows
    // against this preview inside one transaction before archiving and removal.
    await api(`/api/assignments/${encodeURIComponent(id)}/delete-record`,{method:'POST',body:{confirm:true,expected_version:preview.version}}, {epoch});
    if(!unchanged()||editorSubmit!==submit)return;
    invalidateResultsScoringProgress();invalidateAbilityStats();matrix=null;practicalData=null;practicalScope='';closeEditor();
    try{await refresh();}catch(error){if(unchanged())toast(t('已删除，列表刷新失败，请刷新页面。'));return;}
    if(unchanged())toast(t('删除成功'));
  };
  const count=preview.practical_score_count;
  const body=identity+`<div class="notice warning"><p>${esc(t('只移除本次考试和下列关联实操评分；员工档案、其他考试、直接评分及历史备份保留。'))}</p><p><strong>${esc(t('待移除的关联实操评分'))}：${Number.isSafeInteger(count)&&count>=0?count:'—'} ${esc(t('项'))}</strong></p><p>${esc(t('能力矩阵将按其他有效考试重新计算；没有其他有效考试时，本次理论及实操结果不再显示。'))}</p></div><p class="security-note">${esc(t('删除后无法在界面恢复；本轮参加记录仍保留，不会因此重新获得考试机会。'))}</p><label class="checkbox-field"><input type="checkbox" name="confirm_exam_delete" required><span>${esc(t('我已核对姓名、工号及删除影响，确认删除这条考试记录。'))}</span></label>`;
  openEditor('删除考试记录','仅系统管理员可删除未开始或已结束的考试记录，进行中的考试不能删除。',body,submit,'确定删除');
}
function openAssign(planId=''){if(!permitted('manage_exams'))return;if(!list('plans').length){openEditor('分配考试','先创建岗位考试计划，然后分配给同岗位员工。','',null);return;}openEditor('分配考试','本次作答会使用分配时冻结的题目和规则。',selectField('plan_id','选择考试计划',option('',t('请选择'))+list('plans').filter(p=>p.status==='active').map(p=>option(p.id,p.title,planId)).join(''),'required data-dependent="assignment-plan"')+selectField('employee_id','选择员工',option('',t('请选择')),'required')+`<div class="notice" id="assignment-info">${esc(t('先保存考试计划，再给同岗位员工分配考试。'))}</div>`,async(form)=>{const f=new FormData(form);const result=await api('/api/assignments',{method:'POST',body:{plan_id:f.get('plan_id'),employee_id:f.get('employee_id')}});closeEditor();await refresh();toast(t('考卷已分配'));const assignment=result.assignment||result;const returned=find('assignments',assignment.id)||assignment;if(returned.token)openExamLink(returned);},'分配考试');updateAssignmentPlan();}
function updateAssignmentPlan(){const form=$('#editor-form');const p=find('plans',form.elements.plan_id?.value);const select=form.elements.employee_id;if(!select)return;select.innerHTML=selectOptions('employees',select.value,'请选择',emp=>p&&emp.position_id===p.position_id&&emp.active!==false);const el=$('#assignment-info');if(!el)return;const count=p?planExamQuestionCount(p):0;el.className='notice'+(p&&!count?' warning':'');el.textContent=p?`${t('实际题数')}: ${count} · ${t('题量上限')}: ${p.question_count||50} · ${t('可用题目')}: ${planAvailableQuestionCount(p)} · ${t('考试时长（分钟）')}: ${p.duration_minutes} · ${t('每题等分，折算100分。')}${count?'':' · '+t('尚无可用题目')}`:t('先保存考试计划，再给同岗位员工分配考试。');}
function openExamLink(a){
  if(!a?.token)return;const url=`${location.origin}/take/${encodeURIComponent(a.token)}`;const entryUrl=location.origin+'/exam';const rawCode=String(a.exam_code||'');const grouped=rawCode.replace(/(.{5})(?=.)/g,part=>part+' ');
  const codeBlock=rawCode?`<div class="exam-code-block"><span>${esc(t('考试码'))}</span><strong>${esc(grouped)}</strong>${btn('copy-code','复制考试码',`data-code="${esc(rawCode)}"`,'secondary','')}</div>`:'';
  openEditor('考试链接','将考试码和员工考试入口发给对应员工，也可以直接发送专属链接。',`<div class="readonly-value">${esc(nameOf('employees',a.employee_id))} · ${esc(find('plans',a.plan_id)?.title||'')}</div>${codeBlock}<div class="note-label" style="margin-top:20px">${esc(t('统一考试入口'))}</div><a class="copy-url entry-url" href="/exam" target="_blank" rel="noopener noreferrer">${esc(entryUrl)}</a><div class="note-label" style="margin-top:20px">${esc(t('考试链接'))}</div><div class="copy-url">${esc(url)}</div><div class="actions" style="margin:20px 0 15px">${btn('copy-url','复制链接',`data-url="${esc(url)}"`,'primary','')}<a class="btn secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('打开答题页'))}${icon('arrow')}</a></div><p class="security-note">${esc(t('链接拥有答题权限，请只发送给对应员工。'))}</p>`,null);
}
function openResult(id){const a=find('assignments',id);if(!a)return;let details=a.details||[];if(!Array.isArray(details)){details=details.questions||details.answers||[];}if(!Array.isArray(details))details=[];const normalized=details.map(d=>{const q=d.question||d;const ident=d.question_id||q.id||d.id;return {...q,...d,id:ident,answer:a.details?.answers?.[ident]??d.answer,score:a.details?.grades?.[ident]??d.score};});const essays=normalized.filter(d=>d.type==='essay');let html=`<div class="score-banner"><div><span>${esc(t('员工'))}: ${esc(nameOf('employees',a.employee_id))}</span><br>${esc(find('plans',a.plan_id)?.title||'')}</div><div><strong>${a.status==='completed'?formatScore(a.percent)+'%':esc(t(a.submission_review_required?'提交异常待复核':a.status==='voided'?'已作废，需重新考试':'待批改'))}</strong><div style="text-align:right">${badge(a.status)}</div></div></div>`;html+=terminationRecordNotice(a);if(a.submission_review_required)html+=submissionReviewPanel(a);if(a.submission_review)html+=`<div class="notice">${esc(t('复核说明'))}: ${esc(a.submission_review.note||'')} · ${esc(formatDate(a.submission_review.reviewed_at))}</div>`;html+=normalized.map((q,i)=>{const title=(lang==='id'?q.title_id:q.title_zh)||q.title_zh||q.title_id||q.title||'';const answer=q.answer??q.user_answer??q.response;const score=q.score??q.earned_score;const answerText=Array.isArray(answer)?answer.map(k=>{const o=q.options?.find(o=>o.key===k);return o?`${k}. ${(lang==='id'?o.text_id:o.text_zh)||o.text_zh||o.text_id}`:k;}).join('\n'):String(answer??'');return `<div class="details-card"><h3>${i+1}. ${esc(title)}</h3><span class="badge">${esc(t(types[q.type]||q.type||''))} · ${esc(formatScore(q.points??q.max_score))} ${esc(t('分值'))}</span><p>${esc(t('员工答案'))}: ${esc(answerText||t('未作答'))}</p>${q.correct_answer?`<p>${esc(t('标准答案'))}: ${esc(Array.isArray(q.correct_answer)?q.correct_answer.join(', '):q.correct_answer)}</p>`:''}${q.reference_answer_zh||q.reference_answer_id?`<p>${esc(t('中文参考答案'))}: ${esc((lang==='id'?q.reference_answer_id:q.reference_answer_zh)||q.reference_answer_zh||q.reference_answer_id)}</p>`:''}${q.type==='essay'&&permitted('grade_exams')&&a.status==='pending_review'?field('grade_'+q.id,'人工得分',score??'','number',`required min="0" max="${Number(q.points??q.max_score??0)}" step="0.1" data-grade-id="${esc(q.id)}"`):`<div class="note-label">${esc(t('得分'))}: ${score===null||score===undefined?'—':esc(score)}</div>`}</div>`;}).join('');if(!normalized.length)html+=`<p class="page-sub">${esc(t('当前没有可展示的逐题答卷。'))}</p>`;const needs=permitted('grade_exams')&&a.status==='pending_review'&&!a.submission_review_required&&essays.length;openEditor('考试记录',a.submission_review_required?'提交异常待复核':needs?'仅简答题需要人工给分；完成全部简答题评分后生成最终成绩。':'这份考试已经结束，不能再次修改答案。',html,needs?async(form)=>{const grades=$$('[data-grade-id]',form).map(el=>({question_id:el.dataset.gradeId,score:Number(el.value)}));await api(`/api/assignments/${encodeURIComponent(id)}/grade`,{method:'POST',body:{grades}});closeEditor();await refresh();toast(t('保存成功'));}:null,'保存批改');}
let questionImportSession=null;
const importText=(zh,id)=>lang==='id'?id:zh;
function questionImportItems(){
  return list('work_items').filter(item=>{const position=find('positions',item.position_id),bank=find('question_banks',item.question_bank_id);return item.active!==false&&!isDirectAssessment(item)&&positionInUserScope(position)&&(!hasQuestionBankCatalog()||bankInUserScope(bank)&&bank.active!==false&&bankPositionId(bank)===item.position_id&&questionBankItem(bank,item.position_id));});
}
function questionSetupState(){
  const positions=list('positions').filter(positionInUserScope);
  if(!positions.length)return {route:'positions',message:'还没有岗位，请先添加本部门的岗位。',label:'添加岗位'};
  const items=list('work_items').filter(item=>positions.some(position=>position.id===item.position_id));
  if(!items.some(item=>item.active!==false&&!isDirectAssessment(item)))return {route:'work_items',message:'岗位已配置，请添加并启用考试与实操作业项目，再上传题目。',label:'添加作业项目'};
  if(!questionImportItems().length)return {route:'work_items',message:'作业项目还没有可用题库，请检查项目的启用状态、岗位和考核方式。',label:'检查作业项目'};
  if(!questionImportChoices().length)return {route:'questions',message:'当前筛选下没有可导入的作业题库，请切换岗位或清空筛选。',label:'清空筛选'};
  return null;
}
function questionSetupNotice(){const state=questionSetupState();if(!state)return '';const allowed=canAccessRoute(state.route);return `<div class="notice warning"><p>${esc(t(state.message))}</p>${allowed?(state.route==='questions'?btn('question-clear-filters',state.label,'','secondary',''):btn('navigate',state.label,`data-destination="${state.route}"`,'secondary','')):''}</div>`;}
function questionImportChoices(){
  const items=questionImportItems().filter(item=>(!filters.position_id||item.position_id===filters.position_id)&&(!filters.major_workshop_id||positionMatchesMajor(find('positions',item.position_id),filters.major_workshop_id))),seen=new Set(),choices=[];
  for(const item of items){
    const position=find('positions',item.position_id),major=majorIdForPosition(position),bank=find('question_banks',item.question_bank_id),key=(item.question_bank_id||item.id)+'|'+item.position_id;if(seen.has(key))continue;seen.add(key);
    const name=bank?.name||item.name,nameId=bank?.name_id||item.name_id,label=bank?questionBankLabel(bank):`${positionMajorLabel(position)} · ${lang==='id'?(position.name_id||position.name):position.name} · ${name}${nameId?' / '+nameId:''}`,origin=bank?questionBankItem(bank,item.position_id):item;if(!origin)continue;
    choices.push({value:origin.id,label,bank_id:item.question_bank_id||'',position_id:item.position_id,major_workshop_id:major,item_ids:items.filter(row=>(row.question_bank_id||row.id)===(item.question_bank_id||item.id)&&row.position_id===item.position_id).map(row=>row.id)});
  }
  return choices;
}
function questionImportTarget(form){return questionImportChoices().find(choice=>choice.value===form?.elements?.import_work_item_id?.value)||null;}
function questionImportRowsMatchTarget(rows,form){
  const target=questionImportTarget(form),allowed=new Set(questionImportItems().map(item=>item.id));
  return Boolean(target&&Array.isArray(rows)&&rows.length&&rows.every(row=>{const item=find('work_items',row?.work_item_id);return item&&allowed.has(item.id)&&target.item_ids.includes(item.id)&&item.position_id===target.position_id&&(item.question_bank_id||'')===target.bank_id&&(!row.position_id||row.position_id===target.position_id)&&(!row.question_bank_id||row.question_bank_id===target.bank_id);}));
}

function questionImportCurrent(session,revision=null){return Boolean(session&&questionImportSession===session&&session.epoch===managementEpoch&&session.authority===managementAuthority(data)&&route===session.route&&editorSubmit===session.submit&&$('#editor')?.open&&$('#editor-form')===session.form&&permitted('add_questions')&&(revision===null||revision===session.revision));}
function questionImportSnapshot(form){const file=form.elements.import_file?.files?.[0];return JSON.stringify({source:form.elements.import_source_type?.value,text:form.elements.import_text?.value||'',item:form.elements.import_work_item_id?.value||'',target:questionImportTarget(form),dimension:form.elements.import_dimension?.value||'knowledge',file:file?{name:file.name,size:file.size,lastModified:file.lastModified,type:file.type}:null});}
function questionImportReady(session){return questionImportCurrent(session)&&!session.busyPreview&&!session.busyImport&&session.preview?.can_import===true&&Array.isArray(session.preview.rows)&&session.preview.rows.length>0&&questionImportRowsMatchTarget(session.preview.rows,session.form)&&session.previewSnapshot===questionImportSnapshot(session.form);}
function questionImportCanPreview(session){if(!questionImportCurrent(session))return false;const f=session.form,mode=f.elements.import_source_type.value;return Boolean(questionImportTarget(f))&&(mode==='text'?Boolean(f.elements.import_text.value.trim()):Boolean(f.elements.import_file?.files?.[0]));}
function updateQuestionImportControls(){
  const s=questionImportSession;if(!questionImportCurrent(s))return;const f=s.form,mode=f.elements.import_source_type.value;
  const file=f.elements.import_file,text=f.elements.import_text,item=f.elements.import_work_item_id,dimension=f.elements.import_dimension;
  $('#import-file-area').hidden=mode==='text';$('#import-text-area').hidden=mode!=='text';$('#import-target-area').hidden=false;$('#import-json-help').hidden=mode!=='json';
  if(file){file.disabled=mode==='text'||s.busyImport;file.required=false;file.accept=mode==='json'?'.json,application/json':'.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
  if(text){text.disabled=mode!=='text'||s.busyImport;text.required=false;}
  if(item){item.disabled=s.busyImport;item.required=false;}if(dimension)dimension.disabled=mode==='json'||s.busyImport;
  f.elements.import_source_type.disabled=s.busyImport;
  const label=$('#import-file-label');if(label)label.textContent=mode==='json'?importText('上传 JSON 文件','Unggah berkas JSON'):importText('上传 Word 试题','Unggah soal Word');const hint=$('#import-file-hint');if(hint)hint.textContent=mode==='json'?importText('选择 JSON 文件后自动读取。','Berkas JSON dibaca setelah dipilih.'):importText('选择文件后自动读取，支持 .docx。','Soal dibaca setelah berkas dipilih. Mendukung .docx.');
  $$('[data-import-source]',f).forEach(el=>{el.disabled=s.busyImport;el.hidden=el.dataset.importSource===mode;});
  const save=$('#editor-save');if(save){save.disabled=s.busyPreview||s.busyImport||(!questionImportReady(s)&&!questionImportCanPreview(s));save.textContent=s.busyImport?importText('正在导入…','Sedang mengimpor…'):s.busyPreview?importText('正在读取题目…','Sedang membaca soal…'):questionImportReady(s)?importText(`确认导入 ${s.preview.rows.length} 题 · ${nameOf('positions',questionImportTarget(f)?.position_id)}`,`Impor ${s.preview.rows.length} soal · ${nameOf('positions',questionImportTarget(f)?.position_id)}`):importText('查看题目','Lihat soal');}
  $$('[data-import-row-dimension]',f).forEach(el=>el.disabled=s.busyImport);
}
function invalidateQuestionImport(){const s=questionImportSession;if(!questionImportCurrent(s)||s.busyImport)return;s.revision++;s.autoPreviewPending=false;s.preview=null;s.previewSnapshot='';const panel=$('#question-import-preview');if(panel)panel.innerHTML='';const error=$('#editor-error');if(error)error.hidden=true;updateQuestionImportControls();}
function setQuestionImportSource(mode){const s=questionImportSession;if(!questionImportCurrent(s)||s.busyImport||!['docx','text','json'].includes(mode))return;s.form.elements.import_source_type.value=mode;const file=s.form.elements.import_file?.files?.[0];if(mode!=='text'&&file&&!file.name.toLowerCase().endsWith(mode==='json'?'.json':'.docx'))s.form.elements.import_file.value='';invalidateQuestionImport();if(mode==='text')s.form.elements.import_text.focus();else requestQuestionImportAutoPreview();}
function requestQuestionImportAutoPreview(){const s=questionImportSession;if(!questionImportCurrent(s)||s.busyImport||s.form.elements.import_source_type.value==='text'||!questionImportCanPreview(s))return;s.autoPreviewPending=true;if(s.busyPreview)return;s.autoPreviewPending=false;void previewQuestionImport();}
function changeQuestionImportField(el,auto=false){invalidateQuestionImport();if(auto&&questionImportCurrent(questionImportSession))requestQuestionImportAutoPreview();}
async function runQuestionImportPrimary(form){const s=questionImportSession;if(!questionImportCurrent(s)||s.form!==form)return;if(questionImportReady(s))await commitQuestionImport(form);else await previewQuestionImport();}
function questionImportAnswer(row){const keys=row.correct_answer;if(row.type==='true_false'){const selected=(Array.isArray(row.options)?row.options:[]).find(o=>o?.key===(Array.isArray(keys)?keys[0]:keys));return selected?[selected.text_zh,selected.text_id].filter(Boolean).join(' / '):'—';}return Array.isArray(keys)?keys.join('、'):'—';}
function questionImportPreviewMarkup(result){
  const rows=result.rows||[],questions=result.questions||[],errors=result.errors||[],warnings=result.warnings||[],target=questionImportTarget(questionImportSession?.form),targetLabel=target?.label||[...new Set(rows.map(row=>{const item=find('work_items',row.work_item_id),bank=bankOfQuestion(row);return bank?questionBankLabel(bank):item?`${positionMajorLabel(find('positions',item.position_id))} · ${nameOf('positions',item.position_id)} · ${item.name}`:'';}).filter(Boolean))].join('；');
  const counts=Object.keys(types).filter(type=>rows.some(row=>row.type===type)).map(type=>`${t(types[type])} ${rows.filter(row=>row.type===type).length}`).join(' · ');
  const messages=(items,style)=>items.length?`<ul class="import-messages ${style}">${items.map(message=>`<li>${esc(message)}</li>`).join('')}</ul>`:'';
  return `<div class="notice"><strong>${esc(importText('导入目标','Tujuan impor'))}</strong>：${esc(targetLabel||t('请选择岗位和作业题库'))}</div><div class="import-preview-heading"><h3>${esc(importText('识别结果','Hasil pembacaan'))} · ${esc(result.question_count??rows.length)} ${esc(importText('题','soal'))}</h3><p>${esc(counts)}</p></div>${messages(errors,'form-error')}${warnings.length?`<details class="import-recognition-notes"><summary>${esc(importText('识别说明','Catatan pembacaan'))}</summary>${messages(warnings,'')}</details>`:''}${result.can_import?'':`<p class="form-error">${esc(importText('请修正以下问题后重新识别，整批题目不会部分导入。','Perbaiki masalah di bawah lalu baca ulang. Tidak ada impor sebagian.'))}</p>`}${result.source_text&&questionImportSession?.form?.elements.import_source_type?.value==='docx'?btn('question-import-to-text',importText('转为文字修改','Ubah menjadi teks untuk diperbaiki'),'','link',''):''}<div class="import-preview-questions">${rows.map((row,index)=>{
    const diagnostics=questions.find(q=>q.row_index===index)||questions[index]||{},number=diagnostics.number??index+1,issues=diagnostics.errors||[],notes=diagnostics.warnings||[];
    return `<details class="import-preview-question" ${issues.length?'open':''}><summary><span><strong>${esc(number)}. ${esc(t(types[row.type]||row.type||'—'))}</strong><span>${esc((lang==='id'?row.title_id:row.title_zh)||row.title_zh||row.title_id||'—')}</span></span><b>${esc(importText('答案','Jawaban'))}：${esc(questionImportAnswer(row))}</b></summary><div class="import-question-content"><p lang="zh-CN">${esc(row.title_zh||'')}</p>${row.title_id?`<p lang="id">${esc(row.title_id)}</p>`:''}${(Array.isArray(row.options)?row.options:[]).length?`<ol class="import-option-list">${row.options.map(o=>`<li><strong>${esc(o?.key)}.</strong><div><span>${esc(o?.text_zh||'')}</span>${o?.text_id?`<span lang="id">${esc(o.text_id)}</span>`:''}</div></li>`).join('')}</ol>`:''}<details class="import-row-settings"><summary>${esc(importText('调整评价维度','Atur dimensi'))}</summary><label class="field import-row-dimension"><span>${esc(t('评价维度'))}</span><select data-import-row-dimension="${index}" aria-label="${esc(number+' · '+t('评价维度'))}">${Object.entries(dimensions).map(([key,label])=>option(key,t(label),row.dimension)).join('')}</select></label></details>${messages(issues,'form-error')}${messages(notes,'')}</div></details>`;
  }).join('')}</div><p class="import-confirm-note">${esc(importText('核对目标岗位、作业项目、题目和答案后，点击下方确认导入。','Periksa jabatan tujuan, pekerjaan, soal, dan jawaban, lalu konfirmasi impor di bawah.'))}</p>`;
}
async function questionImportBase64(file){const bytes=new Uint8Array(await file.arrayBuffer());let value='';for(let offset=0;offset<bytes.length;offset+=32768)value+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(value);}
function questionImportLegacyPreview(parsed){
  const input=Array.isArray(parsed)?parsed:parsed?.rows;if(!Array.isArray(input)||!input.length||input.length>2000)throw Error(importText('JSON 必须包含 1 到 2000 道题目。','JSON harus berisi 1 sampai 2000 soal.'));
  const rows=input.map(row=>({...row,status:'draft'})),errors=[],allowed=new Set(questionImportItems().map(item=>item.id));
  if(!questionImportRowsMatchTarget(rows,questionImportSession?.form))errors.push(importText('整批题目必须属于所选岗位和作业题库，请检查导入目标。','Semua soal harus sesuai jabatan dan bank soal pekerjaan yang dipilih. Periksa tujuan impor.'));
  rows.forEach((row,index)=>{
    const invalid=message=>errors.push(importText(`第 ${index+1} 题：`,`Soal ${index+1}: `)+message),filled=value=>typeof value==='string'&&value.trim();
    if(!allowed.has(row.work_item_id))invalid(importText('请选择有权限的考试作业项目。','Pilih pekerjaan ujian yang diizinkan.'));
    if(!['single','multiple','true_false'].includes(row.type))invalid(importText('只支持单选、多选和判断题。','Hanya pilihan tunggal, jamak, dan benar/salah.'));
    if(!filled(row.title_zh)&&!filled(row.title_id))invalid(importText('题干为空。','Pertanyaan kosong.'));
    if(!Object.hasOwn(dimensions,row.dimension||'knowledge'))invalid(importText('评价维度不正确。','Dimensi tidak valid.'));
    const options=Array.isArray(row.options)?row.options:[],keys=options.map(o=>o?.key),answers=row.correct_answer;
    if(options.length<2||options.length>10||new Set(keys).size!==keys.length||options.some(o=>!o||!filled(o.key)||(!filled(o.text_zh)&&!filled(o.text_id)))||(row.type==='true_false'&&options.length!==2))invalid(importText('选项为空、重复或数量不正确。','Pilihan kosong, duplikat, atau jumlahnya tidak valid.'));
    if(!Array.isArray(answers)||!answers.length||new Set(answers).size!==answers.length||answers.some(key=>!keys.includes(key))||(row.type!=='multiple'&&answers.length!==1))invalid(importText('缺少明确标准答案，或答案不在选项中。','Kunci jawaban belum jelas atau tidak ada dalam pilihan.'));
  });
  return {rows,questions:rows.map((_,index)=>({number:index+1,row_index:index,errors:[],warnings:[]})),question_count:rows.length,errors,warnings:[importText('JSON 中的作业项目须与所选岗位和作业题库一致；全部保存为草稿。','Pekerjaan JSON harus sesuai jabatan dan bank soal yang dipilih. Semua soal disimpan sebagai draf.')],can_import:!errors.length};
}
async function previewQuestionImport(){
  const s=questionImportSession;if(!questionImportCurrent(s)||s.busyPreview||s.busyImport)return;
  const revision=s.revision,form=s.form,snapshot=questionImportSnapshot(form),file=form.elements.import_file?.files?.[0],mode=form.elements.import_source_type.value;
  const current=()=>questionImportCurrent(s,revision)&&snapshot===questionImportSnapshot(form)&&file===form.elements.import_file?.files?.[0];
  s.busyPreview=true;s.preview=null;s.previewSnapshot='';if(form.elements.import_confirm)form.elements.import_confirm.checked=false;updateQuestionImportControls();const error=$('#editor-error');if(error)error.hidden=true;
  try{
    let result;
    if(!questionImportTarget(form))throw Error(importText('请先选择目标岗位和作业题库。','Pilih jabatan dan bank soal tujuan terlebih dahulu.'));
    if(mode==='json'){
      if(!file||!file.name.toLowerCase().endsWith('.json'))throw Error(importText('请选择 JSON 文件。','Pilih berkas JSON.'));if(file.size>3*1024*1024)throw Error(t('JSON 文件不能超过 3 MiB。'));
      let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()));}catch{throw Error(importText('JSON 格式不正确，请检查文件。','Format JSON tidak benar. Periksa berkas.'));}if(!current())return;result=questionImportLegacyPreview(parsed);
    }else{
      if(!questionImportChoices().some(choice=>choice.value===form.elements.import_work_item_id.value))throw Error(importText('请先选择要导入的作业题库。','Pilih bank soal pekerjaan terlebih dahulu.'));
      const target=questionImportTarget(form),body={source_type:mode,work_item_id:target.value,position_id:target.position_id,question_bank_id:target.bank_id,dimension:form.elements.import_dimension.value};
      if(mode==='docx'){if(!file||!file.name.toLowerCase().endsWith('.docx'))throw Error(importText('请选择 .docx 文件；旧版 .doc 请另存为 .docx。','Pilih berkas .docx. Simpan berkas .doc lama sebagai .docx.'));if(file.size>2*1024*1024)throw Error(importText('Word 文件不能超过 2 MiB。','Berkas Word tidak boleh melebihi 2 MiB.'));body.content_base64=await questionImportBase64(file);}
      else{body.text=form.elements.import_text.value;if(!body.text.trim())throw Error(importText('请粘贴题目和参考答案。','Tempel pertanyaan beserta kunci jawaban.'));if(new Blob([body.text]).size>1024*1024)throw Error(importText('粘贴文字不能超过 1 MiB。','Teks tidak boleh melebihi 1 MiB.'));}
      if(!current())return;result=await api('/api/questions/import-preview',{method:'POST',body},{epoch:s.epoch,sequence:bootstrapSequence,isCurrent:current});
    }
    if(!current())return;if(!Array.isArray(result.rows)||!Array.isArray(result.errors)||!Array.isArray(result.questions))throw Error(importText('识别结果不完整，请重试。','Hasil pembacaan tidak lengkap. Coba lagi.'));
    if(!questionImportRowsMatchTarget(result.rows,form))result.errors.push(importText('识别题目与所选岗位或作业题库不一致，请重新选择后识别。','Soal yang dibaca tidak sesuai jabatan atau bank soal tujuan. Pilih ulang dan baca kembali.'));
    const target=questionImportTarget(form);result.rows=result.rows.map(row=>({...row,position_id:target?.position_id||row.position_id,question_bank_id:target?.bank_id||row.question_bank_id,status:'draft'}));result.can_import=result.can_import===true&&!result.errors.length&&!result.questions.some(q=>q.errors?.length)&&result.rows.length>0;
    s.preview=result;s.previewSnapshot=snapshot;$('#question-import-preview').innerHTML=questionImportPreviewMarkup(result);
    $('#question-import-preview').scrollIntoView({block:'start',behavior:'auto'});
  }catch(e){if(current()&&error){error.hidden=false;error.textContent=e.message;}}
  finally{if(questionImportCurrent(s)){s.busyPreview=false;const pending=s.autoPreviewPending;s.autoPreviewPending=false;updateQuestionImportControls();if(pending)Promise.resolve().then(()=>{if(questionImportCurrent(s))requestQuestionImportAutoPreview();});}}
}
function questionImportToText(){const s=questionImportSession;if(!questionImportCurrent(s)||s.busyImport||!s.preview?.source_text)return;s.form.elements.import_text.value=s.preview.source_text;s.form.elements.import_source_type.value='text';invalidateQuestionImport();s.form.elements.import_text.focus();}
function changeQuestionImportDimension(el){const s=questionImportSession,index=Number(el.dataset.importRowDimension);if(!questionImportCurrent(s)||s.busyImport||!s.preview?.rows?.[index]||!Object.hasOwn(dimensions,el.value))return;s.preview.rows[index].dimension=el.value;if(s.form.elements.import_confirm)s.form.elements.import_confirm.checked=false;updateQuestionImportControls();}
async function commitQuestionImport(form){
  const s=questionImportSession;if(!questionImportCurrent(s)||form!==s.form||!questionImportReady(s))return;
  const revision=s.revision,snapshot=s.previewSnapshot,current=()=>questionImportCurrent(s,revision)&&snapshot===questionImportSnapshot(form);
  const rows=s.preview.rows.map(row=>({...row,status:'draft'})),body=JSON.stringify({rows});if(new Blob([body]).size>3*1024*1024)throw Error(t('JSON 文件不能超过 3 MiB。'));
  s.busyImport=true;updateQuestionImportControls();
  try{const result=await api('/api/questions/import',{method:'POST',body},{epoch:s.epoch,sequence:bootstrapSequence,isCurrent:current});if(!current())return;const originCurrent=()=>s.epoch===managementEpoch&&s.authority===managementAuthority(data)&&route===s.route;closeEditor();questionImportSession=null;const summary=`${t('已导入')}: ${result.imported??0} · ${t('重复跳过')}: ${result.skipped_duplicates??result.skipped??0} · ${importText('已存草稿','Tersimpan sebagai draf')}`;try{await refresh();}catch{if(originCurrent())toast(summary+' · '+importText('列表刷新失败，请刷新页面。','Daftar gagal diperbarui. Segarkan halaman.'));return;}if(originCurrent())toast(summary);}
  catch(e){if(current())throw e;}
  finally{if(questionImportCurrent(s)){s.busyImport=false;updateQuestionImportControls();}}
}
function openImport(){
  if(!permitted('add_questions'))return;const choices=questionImportChoices();if(!choices.length){toast(t(questionSetupState()?.message||'请先选择岗位和作业题库。'));return;}
  const selected=choices.find(choice=>choice.bank_id===(filters.question_bank_id||filters.work_item_id)||choice.item_ids.includes(filters.work_item_id))?.value||(choices.length===1?choices[0].value:'');
  const body=`<div class="question-import-workbench import-simple"><input type="hidden" name="import_source_type" value="docx" data-import-field><div id="import-target-area">${selectField('import_work_item_id',importText('选择大车间、岗位和作业题库','Pilih area utama, jabatan, dan bank soal pekerjaan'),option('',t('请选择'),selected)+choices.map(choice=>option(choice.value,choice.label,selected)).join(''),'data-import-field')}</div><label class="field" id="import-file-area"><span id="import-file-label"></span><input type="file" name="import_file" data-import-field accept=".docx"><small id="import-file-hint">${esc(importText('选择文件后自动读取，支持 .docx。','Soal dibaca setelah berkas dipilih. Mendukung .docx.'))}</small></label><label class="field" id="import-text-area" hidden><span>${esc(importText('把题目和答案粘贴在这里','Tempel soal dan jawaban di sini'))}</span><textarea name="import_text" data-import-field rows="8" placeholder="${esc(importText('从 Word 复制题目、选项和参考答案，粘贴到这里。','Salin pertanyaan, pilihan, dan kunci jawaban dari Word ke sini.'))}"></textarea></label><div class="import-source-alternatives">${btn('question-import-source',importText('或者直接粘贴题目','Atau tempel teks soal'),'data-import-source="text"','link','')}${btn('question-import-source',importText('改用 Word 文件','Gunakan berkas Word'),'data-import-source="docx" hidden','link','')}</div><details class="import-more-settings"><summary>${esc(importText('更多设置','Pengaturan lain'))}</summary>${selectField('import_dimension',importText('默认评价维度','Dimensi awal'),Object.entries(dimensions).map(([key,label])=>option(key,t(label),'knowledge')).join(''),'data-import-field')}<div class="import-extra-actions">${btn('download-import',importText('下载文字示例','Unduh contoh teks'),'','link','download')}${btn('question-import-source',importText('使用原 JSON 格式','Gunakan format JSON lama'),'data-import-source="json"','link','')}</div><div id="import-json-help" hidden><p class="security-note">${esc(t('文件结构为 {"rows": [...]}，work_item_id 使用当前系统里的作业项目 ID。'))}</p>${btn('download-json-import',importText('下载原 JSON 模板','Unduh templat JSON lama'),'','link','')}</div></details><p class="import-draft-note">${esc(importText('确认后存为草稿，核对启用后才用于考试。','Disimpan sebagai draf; soal digunakan dalam ujian setelah diperiksa dan diaktifkan.'))}</p><section id="question-import-preview" aria-live="polite"></section></div>`;
  openEditor('导入题库',importText('选择岗位作业，上传 Word，核对后导入。','Pilih jabatan dan pekerjaan, unggah Word, lalu periksa dan impor.'),body,runQuestionImportPrimary,importText('查看题目','Lihat soal'));
  questionImportSession={epoch:managementEpoch,authority:managementAuthority(data),route,form:$('#editor-form'),submit:runQuestionImportPrimary,revision:0,preview:null,previewSnapshot:'',busyPreview:false,busyImport:false,autoPreviewPending:false};updateQuestionImportControls();
}
function downloadImport(){const a=document.createElement('a');a.href='/static/question-import-example.txt';a.download='question-import-example.txt';a.click();}

function downloadJsonImport(){const sample={_说明:'结构示意，请用当前作业项目 ID 和你们自己的题目内容替换。未填写内容不能导入。',rows:[{work_item_id:'填写系统中的作业项目ID',dimension:'knowledge',type:'single',title_zh:'',title_id:'',options:[{key:'A',text_zh:'',text_id:''},{key:'B',text_zh:'',text_id:''}],correct_answer:[],reference_answer_zh:'',reference_answer_id:'',points:2,status:'draft'}]};const blob=new Blob([JSON.stringify(sample,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='题库导入结构示意.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openViewQuestion(id){const q=find('questions',id);if(!q)return;openEditor('题目','',`<div class="details-card"><h3>${esc(q.title_zh)}</h3><p>${esc(q.title_id||'')}</p>${(q.options||[]).map(o=>`<p>${esc(o.key)}. ${esc((lang==='id'?o.text_id:o.text_zh)||o.text_zh||o.text_id)}</p>`).join('')}<span class="badge">${esc(t(types[q.type]))} · ${esc(q.points)} ${esc(t('分值'))}</span></div>`,null);}
const examDraftMemory=new Map();
const examSyncStates=new Map(),examClientIds=new Map(),examStartErrors=new Map();
const examServerTimes=new Map();
let examAutosaveTimer=null,examDraftDebounce=null,examRetryTimer=null,examOnlyUnanswered=false;
let examTabId='';
function examToken(){return location.pathname.split('/')[2]||'';}
function draftKey(){return `matrix-exam-draft:${examToken()}`;}
function readDraft(){if(examDraftMemory.has(examToken()))return examDraftMemory.get(examToken());try{return JSON.parse(browserStore.getItem(draftKey())||'{}');}catch{return {};}}
function examCopy(value){return JSON.parse(JSON.stringify(value));}
function examAnswersHash(answers){return JSON.stringify(Object.keys(answers||{}).sort().map(key=>[key,Array.isArray(answers[key])?[...answers[key]].sort():answers[key]]));}
function examSyncKey(token=examToken()){return 'matrix-exam-sync:'+token;}
function examLeaseKey(token=examToken()){return 'matrix-exam-owner:'+token;}
function readExamJSON(key){try{return JSON.parse(browserStore.getItem(key)||'null');}catch{return null;}}
function getExamTabId(){if(!examTabId)examTabId=newSwitchEventId();return examTabId;}
function examClientId(token=examToken()){if(examClientIds.has(token))return examClientIds.get(token);const key='matrix-exam-tab-client:'+token;let value;try{value=sessionStorage.getItem(key);}catch{}if(!validSwitchId(value)){const legacy=readExamJSON(examSyncKey(token)),owner=readExamJSON(examLeaseKey(token)),bound=token===examToken()&&exam?.assignment?.client_binding_required;value=!bound&&legacy?.client_id&&(!owner?.tab_id||Date.now()-Number(owner.updated_at)>=25000)?legacy.client_id:newSwitchEventId();try{sessionStorage.setItem(key,value);}catch{}}examClientIds.set(token,value);return value;}
function releaseExamLease(token=examToken()){const owner=readExamJSON(examLeaseKey(token));if(owner?.tab_id===examTabId)browserStore.removeItem(examLeaseKey(token));}
function examSyncState(token=examToken()){
  if(examSyncStates.has(token))return examSyncStates.get(token);
  const local=readExamJSON(examSyncKey(token))||{},server=token===examToken()?exam?.assignment?.draft_sync||{}:{};
  const state={token,clientId:examClientId(token),revision:Math.max(Number(server.revision)||0,Number(local.revision)||0),ackRevision:Number(server.revision)||0,hash:local.hash||'',ackHash:server.revision?examAnswersHash(exam?.assignment?.draft_answers||{}):'',savedAt:server.saved_at||local.saved_at||'',dirty:false,saving:false,error:'',conflict:false,expired:false,frozenAnswers:null,request:null};
  state.dirty=!state.ackRevision||state.hash!==state.ackHash;
  if(server.client_id&&state.clientId!==server.client_id){state.conflict=true;state.error='服务器存在另一份作答记录，当前答案已保留，请联系车间确认。 / Ada jawaban lain di server. Jawaban lokal tetap disimpan; hubungi petugas area.';}
  examSyncStates.set(token,state);return state;
}
function persistExamSync(state){browserStore.setItem(examSyncKey(state.token),JSON.stringify({client_id:state.clientId,revision:state.revision,hash:state.hash,saved_at:state.savedAt}));}
function claimExamLease(state=examSyncState()){
  const owner=readExamJSON(examLeaseKey(state.token)),tabId=getExamTabId();state.leaseClaimed=false;
  if(owner?.tab_id&&owner.tab_id!==tabId&&Date.now()-Number(owner.updated_at)<25000){state.conflict=true;state.error='此考试已在另一个窗口打开。请回到原窗口继续答题；当前答案已保留。 / Ujian dibuka di jendela lain. Lanjutkan di jendela asal; jawaban ini tetap disimpan.';updateExamSyncStatus(state);lockExamAnswerInputs();return false;}
  if(state.conflict)return false;
  browserStore.setItem(examLeaseKey(state.token),JSON.stringify({tab_id:tabId,updated_at:Date.now()}));state.leaseClaimed=true;return true;
}
function examMaySend(token=examToken()){const state=examSyncStates.get(token);return Boolean(state&&!state.conflict&&state.clientId===examClientId(token)&&state.leaseClaimed!==false);}
function examAnswerLocked(){return examLocked()||Boolean(examSyncStates.get(examToken())?.expired||examSyncStates.get(examToken())?.conflict);}
function lockExamAnswerInputs(){$$('[data-question]').forEach(input=>input.disabled=true);const button=$('#take-form button[type=submit]');if(button)button.disabled=true;}
function draftPayload(answers=readDraft(),token=examToken()){
  const state=examSyncState(token),hash=examAnswersHash(answers);
  if(hash!==state.hash||!state.revision){state.revision++;state.hash=hash;state.dirty=true;persistExamSync(state);}
  return {answers:examCopy(answers),client_id:state.clientId,revision:state.revision};
}
function saveDraft({schedule=true}={}){
  if(!exam||exam.assignment?.status!=='in_progress'||examAnswerLocked())return;
  const answers=readExamAnswers(),state=examSyncState();examDraftMemory.set(examToken(),answers);browserStore.setItem(draftKey(),JSON.stringify(answers));draftPayload(answers);updateExamProgress(answers);updateExamSyncStatus(state);
  if(schedule){clearTimeout(examDraftDebounce);examDraftDebounce=setTimeout(()=>void syncExamDraft(),250);}
}
function readExamAnswers(){const answers={};for(const q of exam?.questions||[]){const elements=$$('[data-question]').filter(el=>el.dataset.question===q.id);if(q.type==='essay')answers[q.id]=elements[0]?.value||'';else answers[q.id]=elements.filter(el=>el.checked).map(el=>el.value);}return answers;}
function examAnswerPresent(answer){return Array.isArray(answer)?answer.length>0:typeof answer==='string'&&Boolean(answer.trim());}
function unansweredExamQuestions(answers=readDraft()){return (exam?.questions||[]).filter(question=>!examAnswerPresent(answers[question.id]));}
function updateExamProgress(answers=readExamAnswers()){
  const questions=exam?.questions||[],count=questions.filter(question=>examAnswerPresent(answers[question.id])).length,el=$('#exam-progress');if(el)el.textContent=`${t('已作答')} ${count} / ${questions.length}`;
  $$('[data-exam-question-nav]').forEach(button=>{const answered=examAnswerPresent(answers[button.dataset.examQuestionNav]);button.classList.toggle('answered',answered);button.setAttribute('aria-label',`${button.textContent.trim()} · ${lang==='id'?(answered?'Sudah dijawab':'Belum dijawab'):(answered?'已答':'未答')}`);});
  const remaining=$('#exam-unanswered-count');if(remaining)remaining.textContent=lang==='id'?`${questions.length-count} belum dijawab`:`未答 ${questions.length-count} 题`;
  $$('[data-exam-question-card]').forEach(card=>{const answered=examAnswerPresent(answers[card.dataset.examQuestionCard]),editing=Boolean(card.contains?.(document.activeElement));card.hidden=examOnlyUnanswered&&answered&&!editing;});
  const empty=$('#exam-unanswered-empty');if(empty)empty.hidden=!(examOnlyUnanswered&&count===questions.length);
}
function updateExamSyncStatus(state=examSyncStates.get(examToken())){
  const target=$('#exam-sync-status');if(!target||!state)return;
  let text=state.conflict?state.error:state.expired?(lang==='id'?'Waktu habis. Jawaban dikunci; sedang mengirim.':'时间已到，答案已锁定，正在提交。'):state.saving?(lang==='id'?'Menyinkronkan jawaban…':'正在同步答案…'):state.error?(navigator.onLine===false?(lang==='id'?'Offline. Jawaban tersimpan di perangkat dan akan disinkronkan.':'离线待同步，答案已保存在本机。'):(lang==='id'?'Sinkronisasi gagal; akan dicoba lagi.':'同步失败，将自动重试。')):state.dirty?(lang==='id'?'Jawaban tersimpan di perangkat, menunggu sinkronisasi.':'已保存在本机，待同步。'):(lang==='id'?'Jawaban tersinkron ke server':'答案已同步到服务器');
  target.textContent=text;target.classList.toggle('is-warning',Boolean(state.error||state.conflict||state.expired));target.classList.toggle('is-synced',!state.dirty&&!state.saving&&!state.error&&!state.conflict&&!state.expired);
}
function recordExamServerTime(result,token=examToken()){const value=result?.server_now||result?.assignment?.server_now,instant=Date.parse(value||'');if(!Number.isFinite(instant))return;const previous=examServerTimes.get(token);if(previous&&instant<previous.serverAt)return;examServerTimes.set(token,{serverAt:instant,localAt:Date.now(),monotonicAt:typeof globalThis.performance?.now==='function'?performance.now():null});}
function examNow(token=examToken()){const clock=examServerTimes.get(token);if(!clock)return Date.now();return clock.serverAt+(clock.monotonicAt!=null&&typeof globalThis.performance?.now==='function'?performance.now()-clock.monotonicAt:Date.now()-clock.localAt);}
async function examTimedRequest(operation){if(typeof AbortController!=='function')return operation(undefined);const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{return await operation(controller.signal);}catch(error){if(error.name==='AbortError')throw new Error(lang==='id'?'Koneksi lambat. Jawaban tetap tersimpan; pengiriman akan dicoba lagi.':'网络响应较慢，答案已保留，将自动重试。');throw error;}finally{clearTimeout(timeout);}}
async function examApi(path,options={}){const token=examToken(),result=await examTimedRequest(signal=>api(path,{...options,...(signal?{signal}:{})}));recordExamServerTime(result,token);return result;}
async function examSwitchRequest(token,options){const result=await examTimedRequest(async signal=>{const response=await fetch(`/api/take/${encodeURIComponent(token)}/switch`,{...options,...(signal?{signal}:{})});const result=await response.json();if(!response.ok){const error=new Error(result.error||t('请求失败，请重试'));error.status=response.status;throw error;}return result;});recordExamServerTime(result,token);return result;}
async function syncExamDraft({force=false}={}){
  const token=examToken();if(!exam||exam.assignment?.status!=='in_progress'||examLocked())return null;
  const state=examSyncState(token);if(state.expired||state.conflict)return null;if(!claimExamLease(state))return null;
  if(state.request){await state.request;if(force&&state.dirty)return syncExamDraft({force:true});return null;}
  if(!state.dirty&&!force)return null;
  const payload=draftPayload(readDraft(),token),revision=payload.revision;state.saving=true;state.error='';updateExamSyncStatus(state);
  const request=(async()=>{try{
    const result=await examApi(`/api/take/${encodeURIComponent(token)}/draft`,{method:'POST',body:payload});
    if(state!==examSyncStates.get(token)||examFinished(exam?.assignment))return result;
    if(result.reason==='finalized'||examFinished(result)){if(token===examToken())await loadExam();return result;}
    if(result.reason==='deadline_passed'){if(token===examToken())expireExam();return result;}
    if(result.accepted===false){state.conflict=true;state.error='发现较新的作答记录，已暂停当前窗口以避免覆盖。请回到原窗口。 / Ada jawaban yang lebih baru. Jendela ini dijeda agar tidak menimpa jawaban; kembali ke jendela asal.';if(token===examToken())lockExamAnswerInputs();return result;}
    state.ackRevision=Math.max(state.ackRevision,Number(result.draft_sync?.revision)||revision);state.savedAt=result.draft_sync?.saved_at||new Date().toISOString();state.ackHash=examAnswersHash(payload.answers);state.dirty=state.hash!==state.ackHash;state.error='';persistExamSync(state);return result;
  }catch(error){state.error=error.message;if(error.status===409){state.conflict=true;state.error='作答窗口发生冲突，当前答案已保留。请回到原窗口或联系车间。 / Konflik jendela ujian. Jawaban lokal tetap disimpan; kembali ke jendela asal atau hubungi petugas.';if(token===examToken())lockExamAnswerInputs();}if(force)throw error;return null;}
  finally{state.saving=false;state.request=null;if(token===examToken())updateExamSyncStatus(state);}})();state.request=request;return request;
}
function startExamAutosave(){clearInterval(examAutosaveTimer);const state=examSyncState();if(!claimExamLease(state))return;draftPayload(readDraft());updateExamSyncStatus(state);examAutosaveTimer=setInterval(()=>{if(!location.pathname.startsWith('/take/')||examFinished(exam?.assignment)){clearInterval(examAutosaveTimer);return;}if(state.expired){void submitExam(true);return;}if(!state.conflict){claimExamLease(state);void syncExamDraft();}},7000);void syncExamDraft();}
function examNavigationMarkup(){return `<section class="exam-navigation" aria-label="${lang==='id'?'Navigasi soal':'题号导航'}"><div class="exam-navigation-tools"><strong>${lang==='id'?'Nomor soal':'题号导航'}</strong><span id="exam-unanswered-count"></span><button type="button" class="btn secondary" data-action="exam-next-unanswered">${lang==='id'?'Ke soal belum dijawab':'跳到未答题'}</button><label class="exam-unanswered-toggle"><input type="checkbox" data-exam-unanswered-toggle ${examOnlyUnanswered?'checked':''}>${lang==='id'?'Hanya yang belum dijawab':'只看未答题'}</label></div><div class="exam-question-numbers">${(exam?.questions||[]).map((question,index)=>`<button type="button" data-action="exam-question" data-exam-question-nav="${esc(question.id)}" aria-controls="exam-question-${index+1}">${index+1}</button>`).join('')}</div><p class="exam-navigation-key">${lang==='id'?'Nomor berwarna = sudah dijawab. Nomor kosong = belum dijawab.':'实色为已答，空心为未答。'}</p></section>`;}
function goToExamQuestion(questionId){const index=(exam?.questions||[]).findIndex(question=>question.id===questionId);if(index<0)return;if(examOnlyUnanswered&&examAnswerPresent(readDraft()[questionId])){examOnlyUnanswered=false;const toggle=$('[data-exam-unanswered-toggle]');if(toggle)toggle.checked=false;updateExamProgress(readDraft());}const target=$('#exam-question-'+(index+1));target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target?.focus({preventScroll:true});}
function goToUnansweredExam(){const question=unansweredExamQuestions()[0];if(question)goToExamQuestion(question.id);else toast(lang==='id'?'Semua soal sudah dijawab.':'全部题目已作答。');}
function examDisplayTitle(assignment){if(lang==='id'&&assignment.plan_title_id)return assignment.plan_title_id;if(lang!=='id')return assignment.plan_title||t('员工答题');const parts=[assignment.workshop_name_id,assignment.position_name_id].filter(Boolean);return parts.length?parts.join(' · ')+' · Ujian kompetensi':assignment.plan_title||t('员工答题');}
function examDeadline(){const assignment=exam?.assignment||{},value=assignment.deadline||((assignment.started_at&&Number(assignment.duration_minutes)>0)?new Date(assignment.started_at).getTime()+Number(assignment.duration_minutes)*60000:null);const deadline=value==null?NaN:new Date(value).getTime();return Number.isFinite(deadline)?deadline:Infinity;}
function expiredExamNotice(){return `<div id="exam-deadline-notice" class="notice warning" role="alert"><strong>${lang==='id'?'Waktu habis. Jawaban telah dikunci.':'时间已到，答案已锁定。'}</strong><p>${lang==='id'?'Sistem akan menghitung jawaban yang diterima server sebelum batas waktu. Pengiriman akan dicoba lagi saat jaringan pulih.':'系统按截止前同步到服务器的答案结算。网络恢复后会继续提交。'}</p><button type="button" class="btn secondary" data-action="exam-retry-submit">${lang==='id'?'Coba kirim lagi':'重试交卷'}</button></div>`;}
function expireExam(){
  if(!exam||exam.assignment?.status!=='in_progress'||examLocked())return;const state=examSyncState();
  if(!state.expired){const answers=$('#take-form')?readExamAnswers():readDraft();draftPayload(answers);state.frozenAnswers=examCopy(answers);examDraftMemory.set(examToken(),state.frozenAnswers);browserStore.setItem(draftKey(),JSON.stringify(state.frozenAnswers));state.expired=true;clearInterval(timer);clearTimeout(examDraftDebounce);lockExamAnswerInputs();const button=$('#take-form button[type=submit]');if(button)button.disabled=true;if($('#editor')?.open)closeEditor();if(!$('#exam-deadline-notice'))$('#take-form')?.insertAdjacentHTML?.('beforebegin',expiredExamNotice());updateExamSyncStatus(state);}
  void submitExam(true);
}
function confirmExamSubmission(){
  if(submittingExam||examAnswerLocked())return;saveDraft();const missing=unansweredExamQuestions(),message=missing.length?(lang==='id'?`Masih ada ${missing.length} soal belum dijawab. Kirim sekarang?`:`还有 ${missing.length} 题未答，确认现在交卷？`):(lang==='id'?'Semua soal sudah dijawab. Jawaban tidak dapat diubah setelah dikirim.':'全部题目已作答。提交后不能更改答案。');
  openEditor('提交试卷',message,`<div class="notice">${esc($('#exam-progress')?.textContent||'')}</div>${missing.length?`<button type="button" class="btn secondary" data-action="exam-return-unanswered">${lang==='id'?'Kembali ke soal belum dijawab':'返回未答题'}</button>`:''}`,async()=>submitExam(false),'确认提交');
}
// Each departure gets one durable event ID; hidden/unload signals share a latch until the page returns.
const terminationPrefix='matrix-exam-termination:',switchPrefix='matrix-exam-switches:';
const terminationEvents=new Set(['visibility_hidden','pagehide','navigation','storage_sync']);
const switchLimit=3,switchStates=new Map();
let activeExamToken='',terminationRequest=null,startingExamToken='',startSwitchEvent='',departureCaptured=document.visibilityState==='hidden',switchSupportError='';
const examFinished=assignment=>['completed','pending_review','voided'].includes(assignment?.status);
function terminationKey(token=examToken()){return terminationPrefix+token;}
function switchKey(token=examToken()){return switchPrefix+token;}
function validSwitchId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(value);}
function newSwitchEventId(){
  if(typeof globalThis.crypto?.getRandomValues!=='function')throw new Error('当前浏览器无法安全记录切屏，请更新浏览器后重试。 / Browser ini tidak dapat mencatat perpindahan layar dengan aman. Perbarui browser lalu coba lagi.');
  const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
}
function emptySwitchState(token){return {version:2,token,server_count:0,acknowledged_ids:[],events:[]};}
function mergeSwitchState(target,value){
  if(!value||value.version!==2||value.token!==target.token)return target;
  target.server_count=Math.max(target.server_count,Math.min(switchLimit,Math.max(0,Number(value.server_count)||0)));
  target.acknowledged_ids=[...new Set([...target.acknowledged_ids,...(Array.isArray(value.acknowledged_ids)?value.acknowledged_ids.filter(validSwitchId):[])])].sort();
  for(const record of Array.isArray(value.events)?value.events:[]){
    if(record?.token!==target.token||!validSwitchId(record.event_id)||!terminationEvents.has(record.event)||!record.answers||typeof record.answers!=='object'||Array.isArray(record.answers))continue;
    if(!target.events.some(existing=>existing.event_id===record.event_id))target.events.push(record);
  }
  target.events.sort((a,b)=>(Number(a.sequence)||1)-(Number(b.sequence)||1)||String(a.detected_at||'').localeCompare(String(b.detected_at||''))||a.event_id.localeCompare(b.event_id));
  return target;
}
function readSwitchState(token=examToken()){
  let state=switchStates.get(token);if(!state){state=emptySwitchState(token);switchStates.set(token,state);}
  try{mergeSwitchState(state,JSON.parse(browserStore.getItem(switchKey(token))||'null'));}catch{}
  // The previous release queued one terminal event. Under the new rule it becomes a single warning.
  try{const legacy=JSON.parse(browserStore.getItem(terminationKey(token))||'null');if(legacy?.token===token&&legacy.reason==='screen_switch'&&legacy.answers&&typeof legacy.answers==='object'&&!Array.isArray(legacy.answers)){
    mergeSwitchState(state,{version:2,token,events:[{token,event_id:'legacy-v1-switch',sequence:1,event:terminationEvents.has(legacy.event)?legacy.event:'navigation',answers:legacy.answers,detected_at:legacy.detected_at||''}]});
    const saved=browserStore.setItem(switchKey(token),JSON.stringify(state));if(saved)browserStore.removeItem(terminationKey(token));
  }}catch{}
  return state;
}
function persistSwitchState(state){
  // Merge before each write so a storage event from another tab cannot discard an acknowledged ID or frozen snapshot.
  try{mergeSwitchState(state,JSON.parse(browserStore.getItem(switchKey(state.token))||'null'));const serialized=JSON.stringify(state);if(browserStore.getItem(switchKey(state.token))!==serialized)browserStore.setItem(switchKey(state.token),serialized);}catch{}
  switchStates.set(state.token,state);return state;
}
function switchCount(token=examToken()){
  const state=readSwitchState(token),ids=new Set([...state.acknowledged_ids,...state.events.map(record=>record.event_id)]);
  return Math.min(switchLimit,Math.max(state.server_count,ids.size));
}
function pendingSwitches(token=examToken()){const state=readSwitchState(token);return state.events.filter(record=>!state.acknowledged_ids.includes(record.event_id));}
function pendingTermination(token=examToken()){return switchCount(token)>=switchLimit?readSwitchState(token).events[switchLimit-1]||{token}:null;}
function examLocked(){return Boolean(switchSupportError||pendingTermination());}
function switchStatusMarkup(){
  const count=switchCount();if(!count||count>=switchLimit)return '';
  return `<strong>第 ${count} / ${switchLimit} 次切屏警告 / Peringatan perpindahan layar ${count} / ${switchLimit}</strong><p>可以继续答题。第 3 次切屏将自动交卷。</p><p>Anda dapat melanjutkan ujian. Perpindahan layar ke-3 akan mengirim jawaban secara otomatis.</p>`;
}
function updateSwitchWarning(){const target=$('#exam-switch-status');if(target){target.innerHTML=switchStatusMarkup();target.hidden=!target.innerHTML;}}
function terminationWarning(){return `<div class="notice warning exam-switch-warning" role="note">${icon('shield')}<div><strong>考试期间请留在本页 / Tetap di halaman ujian</strong><p>切换应用或标签页、锁屏、离开或刷新答题页会记录切屏。第 1、2 次警告，第 3 次自动交卷。</p><p>Berpindah aplikasi/tab, mengunci layar, meninggalkan atau memuat ulang halaman dicatat sebagai perpindahan layar. Ke-1 dan ke-2 diberi peringatan; ke-3 mengirim jawaban otomatis.</p><div id="exam-switch-status" role="status" aria-live="polite" ${switchCount()?'':'hidden'}>${switchStatusMarkup()}</div></div></div>`;}
function terminationRecordNotice(a){
  const count=Number(a?.screen_switch_count)||0,ended=a?.termination_reason==='screen_switch';if(!count&&!ended)return '';
  return `<div class="notice ${ended?'warning':''} exam-termination-record">${ended?`<strong>${esc(t('考试因切屏结束'))}</strong>`:''}${count?`<span>${esc(t('已记录切屏次数'))}: ${esc(count)} / ${switchLimit}</span>`:''}${ended?`<span>${esc(t('终止时间'))}: ${esc(formatDate(a.terminated_at||a.submitted_at))}</span>`:''}</div>`;
}
function freezeExamControls(){clearInterval(timer);clearInterval(examAutosaveTimer);clearTimeout(examDraftDebounce);const dialog=$('#editor');if(dialog?.open)closeEditor();$$('#take-form input,#take-form textarea,#take-form button').forEach(el=>el.disabled=true);}
function renderTerminationPending(){
  freezeExamControls();const support=Boolean(switchSupportError);
  const shell=`<div class="take-shell"><div class="take-top"><span class="take-brand"><img class="brand-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt="">${esc(BRAND)}</span>${langSelect()}</div>${takeEntryLink()}<section class="question-card result-state exam-termination-pending" role="alert"><div class="empty-icon">${icon('shield')}</div><h1>${support?'请更新浏览器 / Perbarui browser':esc(t('已停止作答'))}</h1>${support?`<p>${esc(switchSupportError)}</p>`:'<p>已记录第 3 次切屏，答题已锁定，正在自动交卷。</p><p>Perpindahan layar ke-3 tercatat. Jawaban dikunci dan sedang dikirim otomatis.</p><div class="notice warning"><p>第 3 次切屏时的答案已冻结。网络恢复后会继续发送；请勿清除浏览器数据。</p><p>Jawaban saat perpindahan layar ke-3 telah dibekukan. Pengiriman dilanjutkan setelah jaringan pulih; jangan hapus data browser.</p></div>'}<button class="btn primary" data-action="reload-exam">${esc(t('重试'))}</button></section></div>`;
  $('#app').innerHTML=shell;document.documentElement.lang=lang==='zh'?'zh-CN':'id';document.title=t('已停止作答')+' · '+BRAND;
}
function freezeExam(event){
  const token=activeExamToken||startingExamToken||examToken();
  if(!token||!exam||examFinished(exam.assignment)||(exam.assignment?.status!=='in_progress'&&startingExamToken!==token)||departureCaptured||switchCount(token)>=switchLimit)return false;
  const syncState=examSyncState(token);if(syncState.conflict||!claimExamLease(syncState))return false;
  departureCaptured=true;
  let eventId;try{eventId=newSwitchEventId();}catch(error){switchSupportError=error.message;renderTerminationPending();return false;}
  const answers=$('#take-form')?readExamAnswers():readDraft();
  const sync=draftPayload(answers,token);
  const record={token,event_id:eventId,sequence:switchCount(token)+1,event:terminationEvents.has(event)?event:'navigation',answers:JSON.parse(JSON.stringify(answers)),client_id:sync.client_id,revision:sync.revision,detected_at:new Date().toISOString()};
  const state=readSwitchState(token);state.events.push(record);persistSwitchState(state);
  examDraftMemory.set(token,record.answers);browserStore.setItem('matrix-exam-draft:'+token,JSON.stringify(record.answers));
  if(switchCount(token)>=switchLimit){freezeExamControls();renderTerminationPending();}else updateSwitchWarning();
  void deliverTermination(null,{token,beacon:true});return true;
}
function synchronizeSwitchResult(token,result,eventId=''){
  const state=readSwitchState(token),serverIds=Array.isArray(result?.screen_switch_event_ids)?result.screen_switch_event_ids.filter(validSwitchId):[];
  state.server_count=Math.max(state.server_count,Math.min(switchLimit,Math.max(0,Number(result?.screen_switch_count)||0)));
  state.acknowledged_ids=[...new Set([...state.acknowledged_ids,...serverIds,...(eventId?[eventId]:[])])].sort();persistSwitchState(state);
  if(token===examToken()&&exam){
    // Acknowledging a warning must not replace the active form, its newer answers, selection, or timer.
    exam.assignment={...exam.assignment,screen_switch_count:state.server_count,screen_switch_limit:switchLimit,screen_switch_policy:result?.screen_switch_policy};
    updateSwitchWarning();
  }
  return state;
}
function acceptTerminationResult(token,result){
  if(!examFinished(result))return false;
  try{browserStore.removeItem(terminationKey(token));browserStore.removeItem(switchKey(token));browserStore.removeItem('matrix-exam-draft:'+token);browserStore.removeItem(examSyncKey(token));const owner=readExamJSON(examLeaseKey(token));if(owner?.tab_id===getExamTabId())browserStore.removeItem(examLeaseKey(token));}catch{}
  switchStates.delete(token);examDraftMemory.delete(token);examSyncStates.delete(token);clearInterval(examAutosaveTimer);clearTimeout(examDraftDebounce);clearTimeout(examRetryTimer);
  if(token!==examToken())return true;
  activeExamToken='';switchSupportError='';exam=exam||{assignment:{},questions:[]};exam.assignment={...exam.assignment,...result};renderExam();return true;
}
async function deliverTermination(_record=null,options={}){
  const token=options.token||_record?.token||examToken();if(!token||!examMaySend(token))return null;
  if(terminationRequest?.token===token)return terminationRequest.promise;
  const queued=pendingSwitches(token).filter(record=>!record.client_id||record.client_id===examSyncState(token).clientId);if(!queued.length)return null;
  if(options.beacon&&document.visibilityState==='hidden'){
    // Send the oldest event first; keep later snapshots queued so network arrival cannot reorder the third snapshot.
    for(const record of queued.slice(0,1)){const body=JSON.stringify({event_id:record.event_id,event:record.event,answers:record.answers,...(record.client_id?{client_id:record.client_id,revision:record.revision}:{})}),blob=new Blob([body],{type:'application/json'});if(blob.size>60*1024||typeof navigator.sendBeacon!=='function')break;
      try{navigator.sendBeacon(`/api/take/${encodeURIComponent(token)}/switch`,blob);}catch{}
    }
  }
  const promise=(async()=>{
    let latest=null;
    try{for(;;){
      const record=pendingSwitches(token).find(record=>!record.client_id||record.client_id===examSyncState(token).clientId);if(!record||!examMaySend(token))break;
      const body=JSON.stringify({event_id:record.event_id,event:record.event,answers:record.answers,...(record.client_id?{client_id:record.client_id,revision:record.revision}:{})}),small=new Blob([body]).size<=60*1024;
      const result=await examSwitchRequest(token,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body,keepalive:Boolean(options.beacon&&small)});
      if(result.event_id!==record.event_id)throw new Error('切屏记录尚未确认 / Catatan perpindahan layar belum dikonfirmasi');
      latest=result;synchronizeSwitchResult(token,result,record.event_id);
      if(acceptTerminationResult(token,result))return result;
    }return latest;}catch(error){if(error.status===409){const state=examSyncStates.get(token);if(state){state.conflict=true;state.leaseClaimed=false;state.error='此窗口无权继续答题，请回到原答题窗口。 / Jendela ini tidak diizinkan. Kembali ke jendela ujian asal.';if(token===examToken()){lockExamAnswerInputs();updateExamSyncStatus(state);}}}return null;}
    finally{if(terminationRequest?.token===token)terminationRequest=null;}
  })();
  terminationRequest={token,promise};return promise;
}
async function resumeTerminatedExam(){
  if(!location.pathname.startsWith('/take/'))return;
  const token=examToken();readSwitchState(token);if(examLocked())renderTerminationPending();else updateSwitchWarning();
  const delivered=await deliverTermination(null,{token});if(examFinished(delivered))return;
  // GET catches a beacon that was accepted after the page left, without redrawing an ongoing answer form.
  try{const loaded=await examApi('/api/take/'+encodeURIComponent(token));if(token!==examToken()||examFinished(exam?.assignment)&&!examFinished(loaded.assignment))return;synchronizeSwitchResult(token,loaded.assignment||{});if(examFinished(loaded.assignment)){acceptTerminationResult(token,loaded.assignment);return;}if(loaded.assignment?.status==='in_progress'){if(!exam)exam=loaded;const sync=examSyncState(token);if(claimExamLease(sync)&&pendingSwitches(token).length){const resumed=await deliverTermination(null,{token});if(examFinished(resumed))return;}}if(examLocked())renderTerminationPending();}catch{}
}
async function loadExam(){
  clearInterval(timer);const token=examToken();switchSupportError='';readSwitchState(token);
  if(examLocked())renderTerminationPending();const delivered=examMaySend(token)?await deliverTermination(null,{token}):null;if(examFinished(delivered))return;
  try{
    const loaded=await examApi('/api/take/'+encodeURIComponent(token));if(token!==examToken()||examFinished(exam?.assignment)&&!examFinished(loaded.assignment))return;exam=loaded;synchronizeSwitchResult(token,exam.assignment||{});
    if(!browserStore.getItem('matrix-exam-lang:'+token)&&exam.assignment?.language)lang=exam.assignment.language;
    if(examFinished(exam.assignment)){acceptTerminationResult(token,exam.assignment);return;}
    if(exam.assignment?.status==='in_progress'){
      try{newSwitchEventId();}catch(error){switchSupportError=error.message;renderTerminationPending();return;}
      // Local drafts may be newer than the last warning snapshot. Only recover the server draft when none is stored.
      if(!examDraftMemory.has(token)&&!browserStore.getItem(draftKey())&&exam.assignment.draft_answers){examDraftMemory.set(token,exam.assignment.draft_answers);browserStore.setItem(draftKey(),JSON.stringify(exam.assignment.draft_answers));}
      const sync=examSyncState(token);if(claimExamLease(sync)&&pendingSwitches(token).length){const resumed=await deliverTermination(null,{token});if(examFinished(resumed))return;}
    }
    if(examLocked()){renderTerminationPending();return;}renderExam();
  }catch(e){
    if(examLocked()){renderTerminationPending();return;}
    $('#app').innerHTML=`<div class="take-shell"><div class="take-top"><span class="take-brand"><img class="brand-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt="">${esc(BRAND)}</span>${langSelect()}</div>${takeEntryLink()}<div class="error-screen"><div class="empty-icon">${icon('shield')}</div><h1>${esc(t('考试链接无效或暂时无法读取'))}</h1><p>${esc(e.message)}</p>${btn('reload-exam','重试','','primary','')}</div></div>`;
  }
}
function examQuestionPointsLabel(question,assignment){return String(assignment.scoring_policy||'').startsWith('equal-')?t('每题等分'):formatScore(question.points)+' '+t('分值');}
function renderExam(){
  completePendingRegistration();clearInterval(timer);clearInterval(examAutosaveTimer);
  if(examLocked()&&!examFinished(exam?.assignment)){renderTerminationPending();return;}
  document.documentElement.lang=lang==='zh'?'zh-CN':'id';document.title=t('员工答题')+' · '+BRAND;
  const a=exam.assignment||{},finished=examFinished(a);activeExamToken=a.status==='in_progress'?examToken():'';
  let html=`<div class="take-shell"><div class="take-top"><span class="take-brand"><img class="brand-logo" src="/static/assets/matrix-symbol.svg" width="50" height="50" alt="">${esc(BRAND)}</span>${langSelect()}</div>${takeEntryLink()}<h1 class="take-title">${esc(examDisplayTitle(a))}</h1><div class="exam-info"><span>${esc(t('考生'))}: ${esc(a.employee_name||'—')}</span><span>${esc(a.duration_minutes||'—')} ${esc(t('分钟'))}</span>${a.question_count||exam.questions?.length?`<span>${esc(a.question_count||exam.questions.length)} ${esc(t('题'))}</span>`:''}<span>${badge(a.status||'assigned')}</span></div>${examAssessmentSummary(a)}${String(a.scoring_policy||'').startsWith('equal-')?`<p class="security-note">${esc(t('每题等分，折算100分。'))}</p>`:''}`;
  if(finished){
    browserStore.removeItem(draftKey());const review=Boolean(a.submission_review_required);
    if(a.status==='voided')html+=`<section class="question-card result-state"><div class="empty-icon">${icon('shield')}</div><h2>${lang==='id'?'Ujian dibatalkan':'答卷已作废'}</h2><p>${lang==='id'?'Silakan hubungi petugas area untuk membuka putaran berikutnya.':'请联系车间精益员确认下一轮考试。'}</p><a class="btn primary" href="/exam">${lang==='id'?'Kembali ke halaman ujian':'返回考试入口'}</a></section>`;
    else{
    html+=`<section class="question-card result-state"><div class="empty-icon">${icon(review?'shield':'check')}</div><h2>${esc(review?(lang==='id'?'Jawaban memerlukan pemeriksaan':'答卷待复核'):t(a.termination_reason==='screen_switch'?'考试因切屏结束':a.status==='completed'?'理论考试完成':'考试已提交'))}</h2>${terminationRecordNotice(a)}${a.status==='completed'?`<p class="theory-result-label">${esc(t('理论成绩'))}</p><div class="metric-value">${formatScore(a.percent)}<span style="font-size:20px"> / 100</span></div>`:''}<p>${esc(review?(lang==='id'?'Server belum memiliki jawaban yang tersimpan sebelum batas waktu. Skor belum ditetapkan. Hubungi petugas area untuk memeriksa catatan ujian.':'服务器未收到截止前的有效答案快照，暂不判定分数。请联系车间核对考试记录。'):t(a.status==='completed'?'仅显示理论考试成绩，现场实操另行评分。':'理论待批改，出分后即可参加实操，不设最低分限制。'))}</p>${a.status==='completed'?`<div class="notice">${esc(t('理论出分即可进行实操评分，不设最低分限制。'))}</div>`:''}<p class="security-note">${esc(t('综合等级按员工档案中记录的人员类别及对应权重计算。'))}</p>${a.timed_out&&!review?`<div class="notice warning">${esc(lang==='id'?'Waktu ujian telah habis. Hasil memakai jawaban yang diterima server sebelum batas waktu.':'考试时间已到，按截止前同步到服务器的答案结算。')}</div>`:''}</section>`;
    }
  }else if(a.status==='assigned'){
    html+=`<section class="question-card"><div class="empty-icon">${icon('clipboard')}</div><h2 style="text-align:center;font-size:20px">${esc(t('准备开始考试'))}</h2><p style="text-align:center;color:#6B7B84">${esc(t('开始后按规定时间作答，提交后不能修改。'))}</p><div class="notice">${esc(t('采用该语言题干；未录入翻译时显示已提供的另一种语言。'))}</div>${terminationWarning()}${examStartErrors.get(examToken())?`<div class="form-error" role="alert">${esc(examStartErrors.get(examToken()))}</div>`:''}<button class="btn primary exam-submit" data-action="start-exam">${icon('clock')}${esc(t('开始考试'))}</button></section>`;
  }else{
    const draft=readDraft(),state=examSyncState();
    html+=`${terminationWarning()}<div class="exam-sticky"><div><span class="exam-progress" id="exam-progress"></span><span class="exam-sync-status" id="exam-sync-status" role="status" aria-live="polite"></span></div><span class="timer">${icon('clock')} ${esc(t('剩余时间'))} <span id="exam-timer">--:--</span></span></div>${examNavigationMarkup()}${state.expired?expiredExamNotice():''}<form id="take-form"><p id="exam-unanswered-empty" class="notice success" hidden>${lang==='id'?'Semua soal sudah dijawab. Anda dapat mematikan filter untuk memeriksa kembali.':'全部题目已作答，可关闭筛选后检查答案。'}</p>${(exam.questions||[]).map((q,i)=>{
      const title=(lang==='id'?q.title_id:q.title_zh)||q.title_zh||q.title_id||'';
      return `<section class="question-card" id="exam-question-${i+1}" data-exam-question-card="${esc(q.id)}" tabindex="-1"><div class="question-number">${i+1} / ${exam.questions.length} · ${esc(t(types[q.type]||q.type))} · ${esc(examQuestionPointsLabel(q,a))}</div><div class="question-title">${esc(title)}</div>${q.type==='essay'?`<textarea name="q_${esc(q.id)}" data-question="${esc(q.id)}" rows="5" maxlength="20000" placeholder="${esc(t('请输入内容'))}" aria-label="${esc(t('员工答案'))}">${esc(typeof draft[q.id]==='string'?draft[q.id]:'')}</textarea>`:(q.options||[]).map(o=>`<label class="exam-option"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="q_${esc(q.id)}" data-question="${esc(q.id)}" value="${esc(o.key)}" ${(Array.isArray(draft[q.id])?draft[q.id]:[]).includes(o.key)?'checked':''}><span>${esc(q.type==='true_false'?'':o.key+'. ')}${esc((lang==='id'?o.text_id:o.text_zh)||o.text_zh||o.text_id)}</span></label>`).join('')}</section>`;
    }).join('')}<div class="exam-submit-summary"><span>${lang==='id'?'Periksa soal yang belum dijawab sebelum mengirim.':'交卷前可通过题号导航检查漏答。'}</span><button type="button" class="btn secondary" data-action="exam-next-unanswered">${lang==='id'?'Periksa yang belum dijawab':'检查未答题'}</button></div><button type="submit" class="btn primary exam-submit" ${state.expired||state.conflict?'disabled':''}>${esc(t('提交试卷'))}${icon('arrow')}</button></form>`;
  }
  html+='</div>';$('#app').innerHTML=html;
  if(a.status==='in_progress'){
    if(startSwitchEvent||document.visibilityState==='hidden'){const event=startSwitchEvent||'visibility_hidden';startSwitchEvent='';freezeExam(event);if(examLocked())return;}
    updateExamProgress(draftAnswers());updateExamSyncStatus();const state=examSyncState();
    if(state.expired||state.conflict)lockExamAnswerInputs();
    if(state.expired){void submitExam(true);return;}
    tickTimer();if(!state.expired){timer=setInterval(tickTimer,1000);startExamAutosave();}
  }
}
function draftAnswers(){return readDraft();}
function tickTimer(){if(!exam||exam.assignment.status!=='in_progress'||examLocked())return;const seconds=Math.max(0,Math.ceil((examDeadline()-examNow())/1000));const el=$('#exam-timer');if(el){el.textContent=Number.isFinite(seconds)?`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'--:--';el.parentElement.style.color=seconds<60?'#a43b34':'';}if(seconds===0)expireExam();}
let submittingExam=false;
async function submitExam(automatic=false){
  if(submittingExam||examLocked()||examFinished(exam?.assignment))return;
  if(!automatic&&examNow()>=examDeadline()){expireExam();return;}
  const token=examToken(),state=examSyncState(token);if(state.conflict){updateExamSyncStatus(state);return;}
  if(!state.expired)saveDraft({schedule:false});const answers=examCopy(state.expired?state.frozenAnswers||readDraft():readDraft());
  submittingExam=true;clearTimeout(examDraftDebounce);const button=$('#take-form button[type=submit]');if(button){button.disabled=true;button.textContent=t('正在提交…');}lockExamAnswerInputs();
  try{
    await deliverTermination();if(examLocked()||examFinished(exam?.assignment)||token!==examToken())return;
    if(pendingSwitches().length)throw new Error('切屏记录尚未同步，请联网后重试提交。 / Catatan perpindahan layar belum tersinkron. Hubungkan jaringan lalu kirim lagi.');
    if(!state.expired)await syncExamDraft({force:true});else if(state.request){try{await state.request;}catch{}}
    if(examLocked()||examFinished(exam?.assignment)||token!==examToken())return;
    if(state.conflict)throw new Error(state.error);
    const payload=draftPayload(state.expired?state.frozenAnswers||answers:answers,token);
    const result=await examApi(`/api/take/${encodeURIComponent(token)}/submit`,{method:'POST',body:payload});
    if(token!==examToken())return;if($('#editor')?.open)closeEditor();exam.assignment={...exam.assignment,...result};
    if(examFinished(result))acceptTerminationResult(token,result);else if(!examLocked())renderExam();
  }catch(error){
    if(examLocked()||token!==examToken())return;state.error=error.message;updateExamSyncStatus(state);toast(error.message);
    if(automatic||state.expired){clearTimeout(examRetryTimer);examRetryTimer=setTimeout(()=>{if(token===examToken()&&!examFinished(exam?.assignment))void submitExam(true);},5000);}
  }finally{
    submittingExam=false;if(token===examToken()&&!examAnswerLocked()&&!examFinished(exam?.assignment)){$$('[data-question]').forEach(input=>input.disabled=false);if(button?.isConnected!==false){button.disabled=false;button.textContent=t('提交试卷');}}
  }
}
async function startExam(el){
  if(examLocked())return;newSwitchEventId();const token=examToken(),sync=examSyncState(token);if(!claimExamLease(sync))return;el.disabled=true;examStartErrors.delete(token);startingExamToken=token;startSwitchEvent='';
  try{
    const started=await examApi(`/api/take/${encodeURIComponent(token)}/start`,{method:'POST',body:{client_id:sync.clientId}});
    if(token===examToken()&&location.pathname.startsWith('/take/'))exam=started;
    if(pendingSwitches(token).length)await deliverTermination(null,{token});
    if(token===examToken()&&location.pathname.startsWith('/take/'))renderExam();
  }catch(error){if(exam?.assignment?.status!=='in_progress'){releaseExamLease(token);examStartErrors.set(token,error.message);if(token===examToken())renderExam();}throw error;}finally{startingExamToken='';el.disabled=false;}
}
async function openScoreHistory(el){
  const query=new URLSearchParams({employee_id:el.dataset.employee,work_item_id:el.dataset.item});if(el.dataset.mode!=='direct'&&el.dataset.assignment)query.set('assignment_id',el.dataset.assignment);
  const response=await api((el.dataset.mode==='direct'?'/api/direct/history':'/api/practical/history')+'?'+query.toString()),records=Array.isArray(response)?response:response.records||response.history||[];
  openEditor('评分历史',nameOf('work_items',el.dataset.item),records.length?`<div class="score-history-list">${records.map(record=>`<article><strong>${esc(record.score)} / 5 · ${esc(el.dataset.mode==='direct'?(lang==='id'?directScale()[Number(record.score)-1]?.label_id:directScale()[Number(record.score)-1]?.label_zh):practicalScoreHint(record.score))}</strong><p>${esc(formatDate(record.reviewed_at))} · ${esc(record.reviewed_by||record.reviewer_name||'—')}</p>${record.note?`<p>${esc(record.note)}</p>`:''}</article>`).join('')}</div>`:`<p>${esc(t('还没有评分历史'))}</p>`,null);
}
async function handleAction(el){const action=el.dataset.action;switch(action){case'question-import-source':setQuestionImportSource(el.dataset.importSource);return;case'question-import-preview':await previewQuestionImport();return;case'question-import-to-text':questionImportToText();return;case'download-json-import':downloadJsonImport();return;case'question-clear-filters':filters={};$('#content').innerHTML=collectionPage();return;case'create-work-category':openWorkCategoryEditor(el.dataset.inline?{inline:true,form:$('#editor-form')}:null);return;case'save-inline-work-category':await saveInlineWorkCategory(el);return;case'cancel-inline-work-category':cancelInlineWorkCategory();return;case'development-refresh':await loadDevelopment({force:true});return;case'development-export':exportDevelopment();return;case'exam-cleanup-refresh':await loadExamCleanup({force:true});return;case'exam-cleanup-settings':openExamCleanupSettings();return;case'exam-cleanup-apply':openExamCleanupApply();return;case'stats-refresh':await loadAbilityStats({force:true});return;case'stats-drill':drillAbilityStats(el.dataset.key,el.dataset.id);return;case'results-scoring-refresh':await loadResultsScoringProgress({force:true});return;case'matrix-score-mode':setMatrixScoringMode(el.dataset.mode);return;case'matrix-multi-all':selectMatrixScoringEmployees(true);return;case'matrix-multi-none':selectMatrixScoringEmployees(false);return;case'matrix-multi-save':await saveMatrixMultiScores();return;case'resume-exam':{const path=pendingExamPath();if(path)openResolvedExam({path});else renderExamEntry();return;}case'score-history':await openScoreHistory(el);return;case'exam-question':goToExamQuestion(el.dataset.examQuestionNav);return;case'exam-next-unanswered':goToUnansweredExam();return;case'exam-return-unanswered':closeEditor();goToUnansweredExam();return;case'exam-retry-submit':await submitExam(true);return;case'review-submission':await reviewSubmission(el);return;case'matrix-save-all':await savePracticalScores('matrix');return;case'practical-save-all':await savePracticalScores('practical');return;case'matrix-export-selected':openMatrixEmployeeExport();return;case'matrix-export-all':setMatrixExportSelection(true);return;case'matrix-export-clear':setMatrixExportSelection(false);return;case'goto-practical':gotoPractical();return;case'practical-assignment':gotoPractical(find('assignments',el.dataset.id));return;case'export-workshop':await exportWorkshop(el);return;case'toggle-nav':$('.sidebar')?.classList.toggle('open');return;case'navigate':navigate(el.dataset.destination);return;case'logout':invalidateManagementRequests();resetMatrixSession();await api('/api/logout',{method:'POST',body:{}});clearManagementEditor();data={};route='login';history.replaceState({},'','/login');renderLogin();return;case'close-dialog':closeEditor();return;case'create':if(el.dataset.collection==='plans'){openRoundEditor();return;}if(canWrite(el.dataset.collection))openEntityEditor(el.dataset.collection);return;case'edit':if(canEdit(el.dataset.collection,find(el.dataset.collection,el.dataset.id)))openEntityEditor(el.dataset.collection,el.dataset.id);return;case'delete':if(canDelete(el.dataset.collection))openDelete(el.dataset.collection,el.dataset.id);return;case'view-question':openViewQuestion(el.dataset.id);return;case'round-create':openRoundEditor();return;case'round-edit':openRoundEditor(el.dataset.id);return;case'round-toggle':await toggleExamRound(el);return;case'round-next':openNextRound(el.dataset.id);return;case'assign':return;case'exam-link':if(permitted('manage_exams'))openExamLink(find('assignments',el.dataset.id));return;case'copy-code':try{await navigator.clipboard.writeText(el.dataset.code);toast(t('考试码已复制'));}catch{const value=$('.exam-code-block strong');if(value){const range=document.createRange();range.selectNodeContents(value);getSelection().removeAllRanges();getSelection().addRange(range);toast(lang==='id'?'Kode dipilih, salin secara manual.':'考试码已选中，可手动复制。');}}return;case'copy-url':try{await navigator.clipboard.writeText(el.dataset.url);toast(t('链接已复制'));}catch{const value=$$('.copy-url').find(value=>value.textContent===el.dataset.url);if(value){const range=document.createRange();range.selectNodeContents(value);getSelection().removeAllRanges();getSelection().addRange(range);toast(lang==='id'?'Tautan dipilih, salin secara manual.':'链接已选中，可手动复制。');}}return;case'delete-exam-record':await openDeleteExamRecord(el.dataset.id);return;case'result-details':openResult(el.dataset.id);return;case'import':if(permitted('add_questions'))openImport();return;case'download-import':downloadImport();return;case'add-option':{const rows=$$('.option-editor');if(rows.length>=10){toast(lang==='id'?'Maksimal 10 pilihan.':'最多10个选项。');return;}const used=rows.map(r=>r.dataset.key);const key='ABCDEFGHIJ'.split('').find(k=>!used.includes(k));$('#question-option-rows').insertAdjacentHTML('beforeend',optionEditor({key},false,$('#editor-form').elements.type.value));return;}case'remove-option':el.closest('.option-editor')?.remove();return;case'reload-page':location.reload();return;case'reload-exam':await loadExam();return;case'start-exam':await startExam(el);return;}}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-route]');if(nav){e.preventDefault();navigate(nav.dataset.route);return;}const el=e.target.closest('[data-action]');if(!el||el.tagName==='SELECT')return;e.preventDefault();if(el.disabled)return;Promise.resolve(handleAction(el)).catch(error=>toast(error.message));});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.matches('[data-import-field]')){changeQuestionImportField(el,true);return;}if(el.matches('[data-import-confirm]')){updateQuestionImportControls();return;}if(el.matches('[data-import-row-dimension]')){changeQuestionImportDimension(el);return;}
  if(['work-item-position','work-category'].includes(el.dataset.dependent))updateWorkCategoryChoices();
  if(el.matches('[data-development-filter]')){changeDevelopmentFilter(el.dataset.developmentFilter,el.value);return;}
  if(el.matches('[data-stats-filter]')){changeAbilityStatsFilter(el.dataset.statsFilter,el.value);return;}
  if(el.matches('[data-matrix-score-employee]')){changeMatrixScoringSelection(el.value,el.checked);return;}
  if(el.matches('[data-exam-unanswered-toggle]')){examOnlyUnanswered=el.checked;updateExamProgress(readDraft());return;}
  if(el.closest('#employee-entry-form'))invalidateChangedRegistration(readIdentityEntry());
  if(el.matches('[data-action="export-workshop-select"]')){filters.export_workshop_id=el.value;const button=$('[data-action="export-workshop"]');if(button)button.disabled=!el.value;return;}
  if(el.matches('[data-action="language"]')){
    if(location.pathname.startsWith('/take/')){saveDraft();lang=el.value;browserStore.setItem('matrix-exam-lang:'+examToken(),lang);browserStore.setItem('matrix-entry-lang',lang);if(exam)renderExam();else loadExam();}
    else if(location.pathname==='/exam'){const input=$('#exam-entry-form')?.elements.exam_entry.value||'',identity=readIdentityEntry();lang=el.value;browserStore.setItem('matrix-entry-lang',lang);renderExamEntry('',input,identity);}
    else{captureMatrixDrafts();lang=el.value;browserStore.setItem('matrix-ui-lang',lang);if(location.pathname==='/login')renderLogin();else render();}return;
  }
  if(el.matches('[data-matrix-export-employee]')){if(el.checked)matrixExportSelection.add(el.value);else matrixExportSelection.delete(el.value);updateMatrixExportSelection();return;}
  if(el.closest('.matrix-score-form, .practical-score-form'))captureMatrixDrafts();
  if(el.matches('[data-filter]')){captureMatrixDrafts();if(el.dataset.filter==='practical_workshop'){filters.workshop_id=el.value;filters.position_id='';filters.employee_id='';practicalData=null;practicalScope='';$('#content').innerHTML=practicalPage();return;}if(el.dataset.filter==='practical_position'){filters.position_id=el.value;filters.employee_id='';practicalData=null;practicalScope='';loadPractical();return;}if(el.dataset.filter==='practical_employee'){filters.employee_id=el.value;renderPracticalContent();return;}if(['matrix_workshop','matrix_position','matrix_employee'].includes(el.dataset.filter)){captureMatrixDrafts();if(el.dataset.filter==='matrix_workshop'){filters.workshop_id=el.value;filters.position_id='';filters.employee_id='';matrix=null;resetMatrixExportSelection();$('#content').innerHTML=matrixPage();return;}if(el.dataset.filter==='matrix_position'){filters.position_id=el.value;filters.employee_id='';matrix=null;resetMatrixExportSelection();$('#content').innerHTML=matrixPage();loadMatrix();return;}filters.employee_id=el.value;renderMatrixContent();return;}filters[el.dataset.filter]=el.value;if(el.dataset.filter==='major_workshop_id'){filters.position_id='';filters.work_item_id='';filters.question_bank_id='';}if(el.dataset.filter==='workshop_id')filters.position_id='';if(el.dataset.filter==='position_id'){filters.work_item_id='';filters.question_bank_id='';}$('#content').innerHTML=collectionPage();return;}
  if(el.dataset.dependent==='position-major')updatePositionScope();if(el.dataset.dependent==='assessment-mode'){const hint=$('#work-item-mode-help');if(hint)hint.textContent=t(el.value==='direct'?'直接评分项目不录入题目。':'考试作业需理论与实操；直接评分项目无需考试。');}if(el.dataset.dependent==='round-major')updateRoundScope();if(el.dataset.dependent==='round-workshop')updateRoundWorkshopScope();if(el.dataset.dependent==='round-scope')updateRoundPool();if(el.dataset.dependent==='entry-workshop')updateEntryPositions();if(['entry-position','entry-category'].includes(el.dataset.dependent)){updateEntryAvailability();const error=$('#identity-entry-error');if(error)error.hidden=true;}if(['question-major','question-position','question-bank'].includes(el.dataset.dependent))updateQuestionHierarchy();if(el.dataset.dependent==='question-type')updateQuestionType();if(el.dataset.dependent==='employee-workshop')updateDependentPositions();if(['employee-position','employee-category'].includes(el.dataset.dependent))updateEmployeeAssessmentCategory();if(el.dataset.dependent==='plan-position')updatePlanPool();if(el.dataset.dependent==='assignment-plan')updateAssignmentPlan();if(el.matches('[data-question]'))saveDraft();
});
document.addEventListener('input',e=>{const el=e.target;if(el.matches('[data-import-field]')){changeQuestionImportField(el,false);return;}if(el.matches('[data-development-search]')){const start=el.selectionStart,end=el.selectionEnd;changeDevelopmentFilter('search',el.value);const next=$('[data-development-search]');next?.focus?.({preventScroll:true});try{next?.setSelectionRange?.(start,end);}catch{}return;}if(el.matches('[data-matrix-score-search]')){matrixScoringSearch=el.value;const list=$('#matrix-multi-employee-list');if(list)list.innerHTML=matrixScoringEmployeeList();return;}if(el.closest('#employee-entry-form')){invalidateChangedRegistration(readIdentityEntry());const error=$('#identity-entry-error');if(error)error.hidden=true;}if(el.closest('.matrix-score-form, .practical-score-form'))captureMatrixDrafts();if(el.matches('[data-filter="search"]')){filters.search=el.value;$('#table-content').innerHTML=tableBody(filteredRows());}if(el.matches('[data-question]'))saveDraft();});
document.addEventListener('submit',async e=>{
  const form=e.target;if(form.matches('.matrix-score-form')){e.preventDefault();await submitMatrixPractical(form);return;}if(form.matches('.practical-score-form')){e.preventDefault();await submitPractical(form);return;}if(!['login-form','editor-form','take-form','exam-entry-form','employee-entry-form'].includes(form.id))return;e.preventDefault();
  if(form.id==='take-form'){confirmExamSubmission();return;}
  const button=form.id==='editor-form'?$('#editor-save'):$('button[type=submit]',form);if(button.disabled)return;button.disabled=true;const oldText=button.textContent;button.textContent=t(['exam-entry-form','employee-entry-form'].includes(form.id)?'正在加载…':'正在保存…');
  try{
    if(form.id==='exam-entry-form'){const error=$('#entry-error');if(error)error.hidden=true;await enterExam(form);}else if(form.id==='employee-entry-form'){const error=$('#identity-entry-error');if(error)error.hidden=true;await enterIdentityExam(form);}
    else if(form.id==='login-form'){const f=new FormData(form);await api('/api/login',{method:'POST',body:{username:f.get('username'),password:f.get('password')}});form.elements.password.value='';invalidateManagementRequests(true);const next=safeManagementPath(new URLSearchParams(location.search).get('next'));route=next.split('?')[0].slice(1);history.replaceState({},'',next);await refresh();}
    else if(editorSubmit)await editorSubmit(form);
  }catch(error){
    if(form.id==='login-form'){if(location.pathname!=='/login')goLogin(error.message);else renderLogin(error.message);}
    else if(['exam-entry-form','employee-entry-form'].includes(form.id)){const identity=form.id==='employee-entry-form',message=$(identity?'#identity-entry-error':'#entry-error');if(message){message.hidden=false;message.textContent=examEntryError(error,identity);}}
    else{const el=$('#editor-error');if(el){el.hidden=false;el.textContent=error.message;el.scrollIntoView({block:'nearest'});}}
  }finally{if(button.isConnected){button.disabled=false;button.textContent=oldText;if(questionImportSession?.form===form)updateQuestionImportControls();}}
});
$('#editor').addEventListener('cancel',()=>{editorSubmit=null;});
$('#editor').addEventListener('close',()=>{if(!$('#editor')?.open){refreshManagementConfiguration();}});
window.addEventListener('popstate',()=>{
  captureScreenSwitch('navigation');captureMatrixDrafts();invalidateResultsScoringProgress();invalidateAbilityStats();route=location.pathname.split('/')[1]||'dashboard';filters={};matrix=null;practicalData=null;practicalScope='';
  if(route==='take'){invalidateManagementRequests(true);resetMatrixSession();renderedManagementRoute='';const preferred=browserStore.getItem('matrix-exam-lang:'+examToken());if(preferred)lang=preferred;exam=null;loadExam();}
  else if(route==='exam'){resetMatrixSession();lang=browserStore.getItem('matrix-entry-lang')==='id'?'id':'zh';renderExamEntry();loadExamOptions();}
  else if(route==='login')void restoreLoginSession();
  else if(data.user){render();refresh({background:true}).catch(error=>{if(error.status!==401&&!publicLocation())toast(error.message);});}
  else refresh().catch(error=>{if(error.status!==401&&!publicLocation())toast(error.message);});
});
function captureScreenSwitch(event){if(startingExamToken&&!activeExamToken)startSwitchEvent=event;freezeExam(event);}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')captureScreenSwitch('visibility_hidden');else{departureCaptured=false;void resumeTerminatedExam();}});
window.addEventListener('pagehide',()=>{captureScreenSwitch('pagehide');releaseExamLease();});
window.addEventListener('beforeunload',()=>captureScreenSwitch('navigation'));
window.addEventListener('online',()=>{void resumeTerminatedExam();if(location.pathname.startsWith('/take/')&&exam?.assignment?.status==='in_progress'){const state=examSyncStates.get(examToken());if(state?.expired)void submitExam(true);else void syncExamDraft();}});
window.addEventListener('offline',()=>{const state=examSyncStates.get(examToken());if(state){state.error='offline';updateExamSyncStatus(state);}});
window.addEventListener('pageshow',()=>{if(document.visibilityState!=='hidden')departureCaptured=false;void resumeTerminatedExam();});
window.addEventListener('storage',event=>{
  if(location.pathname.startsWith('/take/')&&event.key===examLeaseKey()&&event.newValue){const state=examSyncStates.get(examToken());if(state&&!examFinished(exam?.assignment))claimExamLease(state);return;}
  if(!location.pathname.startsWith('/take/')||![switchKey(),terminationKey()].includes(event.key)||!event.newValue)return;
  if(event.key===switchKey()){try{mergeSwitchState(readSwitchState(),JSON.parse(event.newValue));}catch{}}
  const state=readSwitchState();persistSwitchState(state);if(examFinished(exam?.assignment))return;
  if(examLocked()){freezeExamControls();renderTerminationPending();}else updateSwitchWarning();
  void deliverTermination();
});
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute?.('download')||!activeExamToken||examLocked())return;let url;try{url=new URL(link.href,location.href);}catch{return;}if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search)captureScreenSwitch('navigation');},true);
(async()=>{
  if(location.pathname==='/login'){await restoreLoginSession();return;}
  if(location.pathname==='/exam'){lang=browserStore.getItem('matrix-entry-lang')==='id'?'id':'zh';renderExamEntry();await loadExamOptions();return;}
  if(location.pathname.startsWith('/take/')){const preferred=browserStore.getItem('matrix-exam-lang:'+examToken());if(preferred)lang=preferred;await loadExam();return;}
  try{await refresh();}catch(e){sessionChecked=true;if(e.status===401){if(location.pathname!=='/login')goLogin();}else $('#app').innerHTML=`<div class="error-screen"><h1>${esc(t('加载失败'))}</h1><p>${esc(e.message)}</p><button class="btn primary" data-action="reload-page">${esc(t('重试'))}</button></div>`;}
})();
})();

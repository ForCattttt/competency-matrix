"""General scoring anchors; workshops retain ownership of operation-specific criteria."""
from copy import deepcopy

PRACTICAL_GUIDANCE_VERSION = 'practical-guidance-v1-20261017'
PRACTICAL_GUIDANCE = [
    {'score': 1, 'label_zh': '尚不能完成', 'label_id': 'Belum mampu menyelesaikan',
     'description_zh': '尚不能按作业标准完成主要步骤，需要重新学习与训练。',
     'description_id': 'Belum mampu menyelesaikan langkah utama sesuai standar; perlu belajar dan berlatih kembali.'},
    {'score': 2, 'label_zh': '需全程指导', 'label_id': 'Perlu bimbingan penuh',
     'description_zh': '需评分人在全过程逐步指导，才能完成作业。',
     'description_id': 'Hanya dapat menyelesaikan pekerjaan dengan bimbingan langkah demi langkah sepanjang proses.'},
    {'score': 3, 'label_zh': '需局部协助', 'label_id': 'Perlu bantuan pada beberapa langkah',
     'description_zh': '能完成大部分步骤，但部分关键步骤仍需提醒或协助。',
     'description_id': 'Mampu menyelesaikan sebagian besar langkah, tetapi masih memerlukan pengingat atau bantuan pada langkah tertentu.'},
    {'score': 4, 'label_zh': '可独立完成', 'label_id': 'Mampu bekerja mandiri',
     'description_zh': '能独立按要求完成作业，并正确处理本次考核中的常见异常。',
     'description_id': 'Mampu bekerja mandiri sesuai persyaratan dan menangani gangguan umum yang diuji dengan benar.'},
    {'score': 5, 'label_zh': '可示范并指导他人', 'label_id': 'Mampu memberi contoh dan membimbing',
     'description_zh': '能规范示范、说明关键要求，并指导他人正确完成作业。',
     'description_id': 'Mampu memberi contoh sesuai standar, menjelaskan persyaratan utama, dan membimbing orang lain bekerja dengan benar.'},
]


def practical_guidance():
    return {'version': PRACTICAL_GUIDANCE_VERSION, 'scale': deepcopy(PRACTICAL_GUIDANCE),
            'notice_zh': '以上为通用评分参考，请结合本作业标准和现场观察评分；各作业考核要点由车间维护。',
            'notice_id': 'Gunakan panduan umum ini bersama standar pekerjaan dan pengamatan di lapangan. Area kerja menetapkan kriteria tiap pekerjaan.'}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* اللون الأساسي للهوية — أخضر زمردي أعمق وأكثر رقيًا من الأخضر
           الفاتح القديم، بيحافظ على هوية الشركة (أخضر) بس بحس احترافي
           يناسب شركات التأمين */
        primary: {
          50: '#eefbf5',
          100: '#d8f5e6',
          200: '#b5e8cf',
          300: '#7bd5ac',
          400: '#43c98d',
          500: '#16b87d',
          600: '#0d9668',
          700: '#087653',
          800: '#075d45',
          900: '#064b3a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        /* الأخضر القديم كان مطابق تمامًا للأساسي (primary)؛ هنا فصلناه
           إلى درجة "تيل" مميزة عشان حالات النجاح تتفرق بصريًا عن لون
           الهوية نفسه بدل ما يبانوا نفس اللون بالظبط */
        success: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'IBM Plex Sans Arabic', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      /* ظلال أنعم ومتدرجة (soft elevation) بدل ظلال Tailwind الافتراضية
         القاسية شوية — إحساس أحدث وأهدأ. أضيفت "card-hover" و"inset-line"
         كجزء من تحديث الهوية البصرية (بدون تغيير أي قيمة قديمة مُستخدمة
         بالفعل فى الصفحات، فقط إضافات + تنعيم لقيم card/elevated الحالية) */
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.025), 0 6px 18px -10px rgb(6 78 59 / 0.12)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.025), 0 8px 22px -12px rgb(6 78 59 / 0.16)',
        'card-hover': '0 2px 6px 0 rgb(15 23 42 / 0.045), 0 16px 34px -14px rgb(6 78 59 / 0.20)',
        elevated: '0 10px 30px -14px rgb(15 23 42 / 0.20), 0 18px 42px -18px rgb(6 78 59 / 0.18)',
        'primary-glow': '0 6px 18px -6px rgb(5 150 105 / 0.34)',
        /* توهج primary-glow + خط لمعان علوي داخلي مدموجين فى قيمة واحدة
           (Tailwind ما بيدمجش خاصية box-shadow من كلاسين منفصلين، فلازم
           تُكتب كقيمة واحدة) — يُستخدم فى btn-primary بدل primary-glow لوحدها */
        'primary-glow-inset': 'inset 0 1px 0 0 rgb(255 255 255 / 0.35), 0 4px 14px -2px rgb(5 150 105 / 0.32)',
      },
      /* تدرّجات الهوية — بدل الألوان المسطحة فى الأزرار/البطاقات الرئيسية،
         تدرّج لوني هادئ بنفس درجات primary الحالية بالظبط (بدون لون جديد) */
      backgroundImage: {
        'primary-gradient': 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
        'primary-gradient-hover': 'linear-gradient(180deg, #059669 0%, #047857 100%)',
        'surface-wash': 'linear-gradient(160deg, #ecfdf5 0%, #ffffff 55%)',
      },
      letterSpacing: {
        tightest: '-0.02em',
      },
    },
  },
  plugins: [],
};

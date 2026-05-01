export default function AsideFilters() {
    return (
      <aside className="
        fixed inset-y-0 right-0 z-[60]
        w-80 h-[100dvh]
        bg-white dark:bg-zinc-900
        border-l border-zinc-200 dark:border-zinc-800
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:h-auto lg:translate-x-0
        flex flex-col
        shadow-2xl lg:shadow-none
        translate-x-0
      ">
  
        {/* Header (Desktop) */}
        <div className="hidden lg:flex flex-col px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-center font-black text-lg text-brand-600">
            دربك
          </div>
          <p className="text-[10px] text-zinc-500 text-center mt-1">
            تصفية التجارب
          </p>
        </div>
  
        {/* Mobile header */}
        <div className="lg:hidden p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <span className="text-sm font-bold">التصفية</span>
          <button className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            ✕
          </button>
        </div>
  
        {/* Filters */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
  
          {/* الجامعة */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">الجامعة</label>
            <button className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-bold text-right">
              اختر الجامعة
            </button>
          </div>
  
          {/* النوع */}
          <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex">
            <button className="flex-1 bg-white dark:bg-zinc-700 rounded-lg py-2 text-xs font-bold text-brand-600">
              طلاب
            </button>
            <button className="flex-1 py-2 text-xs font-bold text-zinc-500">
              طالبات
            </button>
          </div>
  
          {/* التخصص */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500">التخصص</label>
            <button className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-bold text-right">
              اختر التخصص
            </button>
          </div>
        </div>
  
        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <button className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white font-black py-3 rounded-xl">
            تطبيق الفلتر
          </button>
        </div>
  
      </aside>
    );
  }
  
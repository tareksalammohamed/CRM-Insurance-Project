import { Link } from 'react-router-dom';
import { Home, MapPinOff } from 'lucide-react';

export function NotFound() {
  return (
    <section className="card flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
      <MapPinOff className="h-12 w-12 text-secondary-400" aria-hidden="true" />
      <h1 className="type-h1">الصفحة غير موجودة</h1>
      <p className="text-sm text-secondary-500">الرابط غير صحيح أو تم تغيير عنوان الصفحة.</p>
      <Link to="/" className="btn-primary"><Home className="h-4 w-4" aria-hidden="true" />العودة للرئيسية</Link>
    </section>
  );
}

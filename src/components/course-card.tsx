import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Sparkles, Flame, Star, Award } from "lucide-react";


export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  cover_url?: string | null;
  price: number;
  is_free?: boolean;
  ad_style?: number;
  students_count?: number;
  total_duration_seconds?: number;
};

type Props = {
  course: CourseCardData;
  tenantSlug: string;
  primaryColor?: string;
  secondaryColor?: string;
  currency?: string;
};

function priceLabel(c: CourseCardData, currency: string) {
  if (c.is_free || c.price === 0) return "مجاني";
  return `${c.price} ${currency}`;
}

export function CourseCard({ course, tenantSlug, primaryColor = "#10B981", secondaryColor = "#D4AF37", currency = "ر.س" }: Props) {
  const style = course.ad_style ?? 1;
  const to = "/t/$slug/courses/$courseSlug" as const;
  const params = { slug: tenantSlug, courseSlug: course.slug };
  const subtitle = course.short_description || course.description || "";
  const price = priceLabel(course, currency);

  // 6 ad styles
  if (style === 1) {
    // Classic
    return (
      <Link to={to} params={params}>
        <Card className="hover:shadow-lg transition-shadow overflow-hidden h-full">
          {course.cover_url && <img src={course.cover_url} alt={course.title} className="w-full h-44 object-cover" />}
          <CardContent className="p-4 space-y-2">
            <h3 className="font-bold text-lg line-clamp-2">{course.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
            <div className="flex items-center justify-between pt-2">
              <span className="font-bold text-lg" style={{ color: primaryColor }}>{price}</span>
              {course.students_count != null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{course.students_count}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (style === 2) {
    // Featured / golden ribbon
    return (
      <Link to={to} params={params}>
        <Card className="relative overflow-hidden h-full border-2" style={{ borderColor: secondaryColor }}>
          <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"
               style={{ background: secondaryColor, color: "#000" }}>
            <Star className="h-3 w-3" /> مميّز
          </div>
          {course.cover_url && <img src={course.cover_url} alt={course.title} className="w-full h-44 object-cover" />}
          <CardContent className="p-4">
            <h3 className="font-bold text-lg">{course.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{subtitle}</p>
            <div className="mt-3 text-xl font-extrabold" style={{ color: secondaryColor }}>{price}</div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (style === 3) {
    // Horizontal split
    return (
      <Link to={to} params={params}>
        <Card className="hover:shadow-lg flex h-full overflow-hidden">
          {course.cover_url && <img src={course.cover_url} alt={course.title} className="w-32 h-auto object-cover" />}
          <CardContent className="flex-1 p-4 space-y-2">
            <Badge variant="outline">دورة</Badge>
            <h3 className="font-bold">{course.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
            <div className="font-bold" style={{ color: primaryColor }}>{price}</div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (style === 4) {
    // Gradient hero
    return (
      <Link to={to} params={params}>
        <Card className="relative h-full overflow-hidden text-white">
          <div className="absolute inset-0" style={{
            background: course.cover_url
              ? `linear-gradient(135deg, ${primaryColor}cc, ${secondaryColor}aa), url(${course.cover_url}) center/cover`
              : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          }} />
          <CardContent className="relative p-6 min-h-[200px] flex flex-col justify-end">
            <Flame className="h-6 w-6 mb-2" />
            <h3 className="font-extrabold text-xl">{course.title}</h3>
            <p className="text-sm opacity-90 line-clamp-2 mt-1">{subtitle}</p>
            <div className="mt-2 text-2xl font-black">{price}</div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (style === 5) {
    // Minimal text-first
    return (
      <Link to={to} params={params}>
        <Card className="hover:shadow-md h-full border-r-4" style={{ borderRightColor: primaryColor }}>
          <CardContent className="p-5 space-y-3">
            <Sparkles className="h-5 w-5" style={{ color: primaryColor }} />
            <h3 className="font-bold text-lg">{course.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3">{subtitle}</p>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-bold">{price}</span>
              {course.total_duration_seconds ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(course.total_duration_seconds / 60)} دقيقة
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // style 6 — Premium dark
  return (
    <Link to={to} params={params}>
      <Card className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white h-full overflow-hidden">
        {course.cover_url && <img src={course.cover_url} alt={course.title} className="w-full h-36 object-cover opacity-90" />}
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" style={{ color: secondaryColor }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: secondaryColor }}>بريميوم</span>
          </div>
          <h3 className="font-bold text-lg">{course.title}</h3>
          <p className="text-sm text-zinc-400 line-clamp-2">{subtitle}</p>
          <div className="pt-2 text-xl font-bold" style={{ color: secondaryColor }}>{price}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

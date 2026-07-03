import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <p className="font-display text-6xl font-semibold text-primary">404</p>
      <p className="text-sm text-muted-foreground">Strona nie istnieje / Page not found</p>
      <Button variant="outline" render={<Link to="/dashboard" />}>← Dashboard</Button>
    </div>
  );
}

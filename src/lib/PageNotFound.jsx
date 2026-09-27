import { useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Compass } from 'lucide-react';

export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await base44.auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <Card className="max-w-md w-full text-center surface-card">
                <CardContent className="py-12 px-6">
                    <h1 className="text-7xl font-light text-tertiary">404</h1>
                    <div className="h-0.5 w-16 bg-border mx-auto mt-2" />
                    <h2 className="text-2xl font-semibold text-foreground mt-6">
                        Page not found
                    </h2>
                    <p className="text-muted-foreground leading-relaxed mt-3">
                        The page <span className="font-medium text-foreground">{pageName}</span> doesn't
                        exist or may have moved.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center pt-6">
                        <Button asChild>
                            <Link to="/"><Home className="h-4 w-4 mr-1.5" />Go to homepage</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link to="/verify"><Compass className="h-4 w-4 mr-1.5" />Verify a credential</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    // Supabase recovery links land here with type=recovery in the hash and
    // supabase-js auto-processes them, firing a PASSWORD_RECOVERY event.
    const hash = window.location.hash || '';
    const isRecovery = hash.includes('type=recovery');

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // Fallback: if we already have a session from the recovery link, allow update.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else if (!isRecovery) setInvalid(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast({ title: 'Could not update password', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
            alt="Australian Racing Tours Logo"
            className="h-16 w-16 mx-auto"
          />
          <h1 className="mt-6 text-3xl font-bold text-brand-navy">Set a new password</h1>
        </div>

        <Card className="border-brand-navy/20 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-brand-navy">Reset Password</CardTitle>
            <CardDescription>
              {invalid
                ? 'This reset link is invalid or has expired. Request a new one.'
                : 'Choose a new password for your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!invalid && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2 text-brand-navy">
                    <Lock className="h-4 w-4" /> New password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      className="border-brand-navy/30 focus:border-brand-navy pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="flex items-center gap-2 text-brand-navy">
                    <Lock className="h-4 w-4" /> Confirm password
                  </Label>
                  <Input
                    id="confirm"
                    name="confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Re-enter password"
                    className="border-brand-navy/30 focus:border-brand-navy"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  disabled={isLoading || !ready}
                >
                  {isLoading ? 'Updating...' : ready ? 'Update password' : 'Verifying link...'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
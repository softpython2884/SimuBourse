'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { toast, dismiss } = useToast();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Check if the app is already installed (for most browsers)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
      }
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (installPrompt) {
      // Show the toast after a short delay
      const timer = setTimeout(() => {
        const { id } = toast({
          title: 'Installer l\'application SimuBourse',
          description: 'Obtenez une meilleure expérience en installant l\'application sur votre appareil.',
          duration: Infinity, // Keep it open until dismissed or action taken
          action: (
            <Button
              onClick={async () => {
                const choiceResult = await installPrompt.prompt();
                if (choiceResult.outcome === 'accepted') {
                  console.log('User accepted the install prompt');
                } else {
                  console.log('User dismissed the install prompt');
                }
                setInstallPrompt(null);
                dismiss(id);
              }}
            >
              Installer
            </Button>
          ),
        });
      }, 3000); // 3-second delay

      return () => clearTimeout(timer);
    }
  }, [installPrompt, toast, dismiss]);

  return null; // This component doesn't render anything itself
}

"use client";

import React from "react";
import { Volume2, VolumeX, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsPanelProps {
  soundEnabled: boolean;
  onSoundToggle: () => void;
  particlesEnabled: boolean;
  onParticlesToggle: () => void;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  className?: string;
}

export function SettingsPanel({
  soundEnabled,
  onSoundToggle,
  particlesEnabled,
  onParticlesToggle,
  glowEnabled,
  onGlowToggle,
  className,
}: SettingsPanelProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <SettingToggle
          icon={soundEnabled ? Volume2 : VolumeX}
          label="Sound Effects"
          enabled={soundEnabled}
          onToggle={onSoundToggle}
        />
        <SettingToggle
          icon={Sparkles}
          label="Particles"
          enabled={particlesEnabled}
          onToggle={onParticlesToggle}
        />
        <SettingToggle
          icon={Zap}
          label="Glow Effects"
          enabled={glowEnabled}
          onToggle={onGlowToggle}
        />
      </CardContent>
    </Card>
  );
}

interface SettingToggleProps {
  icon: React.ElementType;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

function SettingToggle({
  icon: Icon,
  label,
  enabled,
  onToggle,
}: SettingToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
        enabled
          ? "bg-cyan-500/20 border border-cyan-500/30"
          : "bg-white/5 border border-white/10 hover:bg-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-4 w-4 ${enabled ? "text-cyan-400" : "text-gray-500"}`}
        />
        <span className={enabled ? "text-white" : "text-gray-400"}>{label}</span>
      </div>
      <div
        className={`w-10 h-6 rounded-full transition-colors ${
          enabled ? "bg-cyan-500" : "bg-gray-600"
        }`}
      >
        <div
          className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </div>
    </button>
  );
}

export default SettingsPanel;

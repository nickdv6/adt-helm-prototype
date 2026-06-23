'use client';
// Client-side wrapper around the RIP·NeoStampa card's header action area.
// Renders Retry / Release Hold (conditional) + a 'View XML' button that opens
// the NeoStampaXmlPreview modal. Lives outside the server-component PR Detail
// so the modal state can live in React.
import { useState } from 'react';
import { Button } from '@/components/ui';
import { RotateCcw, FileCode2 } from 'lucide-react';
import { NeoStampaXmlPreview, XmlJobInput } from './neostampa-xml-preview';

export function RipCardActions({
  status,
  isHeld,
  xmlInput,
}: {
  status: string;
  isHeld: boolean;
  xmlInput: XmlJobInput;
}) {
  const [showXml, setShowXml] = useState(false);
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setShowXml(true)}>
        <FileCode2 className="w-3.5 h-3.5 mr-1" />View XML
      </Button>
      {status === 'error' && (
        <Button size="sm" variant="ghost"><RotateCcw className="w-3.5 h-3.5 mr-1" />Retry job</Button>
      )}
      {isHeld && (
        <Button size="sm" variant="ghost">Release Hold</Button>
      )}
      {showXml && <NeoStampaXmlPreview input={xmlInput} onClose={() => setShowXml(false)} />}
    </div>
  );
}

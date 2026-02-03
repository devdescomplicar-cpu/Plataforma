import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TruncatedTextProps {
  text: string;
  maxWidth?: string;
  className?: string;
  children?: React.ReactNode;
}

export function TruncatedText({ 
  text, 
  maxWidth = '200px', 
  className,
  children 
}: TruncatedTextProps) {
  const content = children || text;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              'truncate',
              className
            )}
            style={{ maxWidth }}
          >
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

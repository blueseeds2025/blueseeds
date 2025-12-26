'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className = '', sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 text-sm shadow-md ' +
        'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 ' +
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ' +
        className
      }
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className = '', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none ' +
      'focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ' +
      className
    }
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className = '', ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={'-mx-1 my-1 h-px bg-gray-200 ' + className}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

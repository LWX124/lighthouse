"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PricingCardProps {
  name: string;
  price: number;
  description: string;
  features: string[];
  isCurrentPlan: boolean;
  isPro: boolean;
  highlighted?: boolean;
  onUpgrade?: () => void;
}

export function PricingCard({
  name,
  price,
  description,
  features,
  isCurrentPlan,
  highlighted = false,
  onUpgrade,
}: PricingCardProps) {
  return (
    <Card
      className={`relative flex flex-col ${
        highlighted ? "border-primary shadow-lg shadow-primary/10" : ""
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge>推荐</Badge>
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{name}</CardTitle>
          {isCurrentPlan && (
            <Badge variant="secondary">当前方案</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="mb-6">
          {price === 0 ? (
            <span className="text-3xl font-bold">免费</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">¥{price}</span>
              <span className="text-muted-foreground">/月</span>
            </div>
          )}
        </div>

        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-primary">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? null : price > 0 ? (
          <Button className="w-full" onClick={onUpgrade}>
            升级到 {name}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

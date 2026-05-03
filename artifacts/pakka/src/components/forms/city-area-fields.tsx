import { useState, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TIER1_CITIES, CITY_AREAS, isTier1City } from "@/data/india-areas";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";

import indianCitiesJson from "indian-cities-json";

const _cities = (
  indianCitiesJson as unknown as { cities: { name: string }[] }
).cities ?? [];

const ALL_CITIES: string[] = Array.from(
  new Set([...TIER1_CITIES, ..._cities.map((c) => c.name)])
).sort();

interface CityAreaFieldsProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  cityField?: Path<T>;
  areaField?: Path<T>;
}

export function CityAreaFields<T extends FieldValues>({
  form,
  cityField = "city" as Path<T>,
  areaField = "area" as Path<T>,
}: CityAreaFieldsProps<T>) {
  const [cityOpen, setCityOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);

  const city = form.watch(cityField) as string;
  const area = form.watch(areaField) as string;
  const tier1 = isTier1City(city);
  const areas = tier1 ? CITY_AREAS[city] : [];

  const selectCity = useCallback(
    (value: string) => {
      form.setValue(cityField, value as T[Path<T>], { shouldValidate: true });
      form.setValue(areaField, "" as T[Path<T>], { shouldValidate: false });
      setCityOpen(false);
    },
    [form, cityField, areaField]
  );

  const selectArea = useCallback(
    (value: string) => {
      form.setValue(areaField, value as T[Path<T>], { shouldValidate: true });
      setAreaOpen(false);
    },
    [form, areaField]
  );

  const cityError = form.formState.errors[cityField];
  const areaError = form.formState.errors[areaField];

  return (
    <>
      <div className="space-y-1">
        <Label>
          City <span className="text-destructive">*</span>
        </Label>
        <Popover open={cityOpen} onOpenChange={setCityOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={cityOpen}
              className="w-full justify-between font-normal text-left"
            >
              <span className={cn(!city && "text-muted-foreground")}>
                {city || "Select city..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search city..." />
              <CommandList className="max-h-60">
                <CommandEmpty>No city found.</CommandEmpty>
                <CommandGroup>
                  {ALL_CITIES.map((c) => (
                    <CommandItem key={c} value={c} onSelect={selectCity}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          city === c ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {c}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {cityError && (
          <p className="text-xs text-destructive">
            {String(cityError.message)}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label>
          Area / Neighbourhood <span className="text-destructive">*</span>
        </Label>
        {tier1 ? (
          <Popover open={areaOpen} onOpenChange={setAreaOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={areaOpen}
                className="w-full justify-between font-normal text-left"
                disabled={!city}
              >
                <span className={cn(!area && "text-muted-foreground")}>
                  {area || "Select area..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search area..." />
                <CommandList className="max-h-60">
                  <CommandEmpty>No area found.</CommandEmpty>
                  <CommandGroup>
                    {areas.map((a) => (
                      <CommandItem key={a} value={a} onSelect={selectArea}>
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            area === a ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {a}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            placeholder={
              city
                ? "Enter your area or neighbourhood"
                : "Select a city first"
            }
            disabled={!city}
            value={area}
            onChange={(e) =>
              form.setValue(areaField, e.target.value as T[Path<T>], {
                shouldValidate: true,
              })
            }
          />
        )}
        {!tier1 && city && (
          <p className="text-xs text-muted-foreground">
            Type your local area or neighbourhood name.
          </p>
        )}
        {areaError && (
          <p className="text-xs text-destructive">
            {String(areaError.message)}
          </p>
        )}
      </div>
    </>
  );
}

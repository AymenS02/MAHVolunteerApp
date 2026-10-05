import PickerField from "@/components/PickerField";
import {
  DEFAULT_PICKER_DATE,
  formatDateOfBirth,
  pickerBounds,
  toDateOnly,
} from "@/utils/dateOfBirth";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform } from "react-native";

type Props = {
  // "YYYY-MM-DD", or null until picked.
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
};

// "YYYY-MM-DD" -> local Date for the picker.
const fromDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function DateOfBirthField({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const bounds = useMemo(() => pickerBounds(), []);

  return (
    <>
      <PickerField
        label="Date of birth"
        value={value ? formatDateOfBirth(value) : "Select your date of birth"}
        placeholder={!value}
        error={error}
        onPress={() => setOpen(true)}
      />
      {open && (
        <DateTimePicker
          value={value ? fromDateOnly(value) : DEFAULT_PICKER_DATE}
          mode="date"
          minimumDate={bounds.minimumDate}
          maximumDate={bounds.maximumDate}
          onChange={(event, selectedDate) => {
            setOpen(Platform.OS === "ios");
            if (event.type === "set" && selectedDate) {
              onChange(toDateOnly(selectedDate));
            }
          }}
        />
      )}
    </>
  );
}

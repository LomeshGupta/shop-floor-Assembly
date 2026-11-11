import Button, { ButtonProps } from "@mui/material/Button";

/** A large, full-width, touch-optimized button — the default action control. */
export default function BigButton(props: ButtonProps) {
  const { sx, ...rest } = props;
  return (
    <Button
      fullWidth
      size="large"
      variant="contained"
      sx={{ minHeight: 72, fontSize: "1.25rem", ...sx }}
      {...rest}
    />
  );
}

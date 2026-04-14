import { Text, TextInput, View } from "react-native";
import type { AuthSessionSnapshot } from "@household/types";
import { styles } from "./styles";
import { ActionButton } from "./ui";

export function AuthCard(props: {
  email: string;
  password: string;
  displayName: string;
  message: string;
  snapshot: AuthSessionSnapshot;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangeDisplayName: (value: string) => void;
  onLogin: () => void;
  onGoogleLogin: () => void;
  onLogout: () => void;
  onSignUp: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{"\uB85C\uADF8\uC778"}</Text>
      <Text style={styles.statusText}>
        {props.snapshot.isAuthenticated
          ? `${props.snapshot.email ?? "\uC0AC\uC6A9\uC790"} \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778\uB428`
          : "\uAC19\uC740 \uACC4\uC815\uC73C\uB85C \uBAA8\uBC14\uC77C\uACFC \uC6F9\uC5D0 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."}
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="\uC774\uBA54\uC77C"
        placeholderTextColor="#6a5f58"
        style={styles.input}
        value={props.email}
        onChangeText={props.onChangeEmail}
      />
      <TextInput
        placeholder="\uBE44\uBC00\uBC88\uD638"
        placeholderTextColor="#6a5f58"
        secureTextEntry
        style={styles.input}
        value={props.password}
        onChangeText={props.onChangePassword}
      />
      <TextInput
        placeholder="\uC774\uB984(\uD68C\uC6D0\uAC00\uC785 \uC2DC \uC120\uD0DD)"
        placeholderTextColor="#6a5f58"
        style={styles.input}
        value={props.displayName}
        onChangeText={props.onChangeDisplayName}
      />
      <View style={styles.row}>
        <ActionButton label="\uC774\uBA54\uC77C \uB85C\uADF8\uC778" onPress={props.onLogin} variant="primary" />
        <ActionButton label="\uD68C\uC6D0\uAC00\uC785" onPress={props.onSignUp} variant="secondary" />
      </View>
      <ActionButton label="Google \uB85C\uADF8\uC778" onPress={props.onGoogleLogin} variant="secondary" />
      {props.snapshot.isAuthenticated ? (
        <ActionButton label="\uB85C\uADF8\uC544\uC6C3" onPress={props.onLogout} variant="ghost" />
      ) : null}
      <Text style={styles.helperText}>{props.message}</Text>
    </View>
  );
}

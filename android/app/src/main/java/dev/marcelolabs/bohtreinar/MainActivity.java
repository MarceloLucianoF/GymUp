package dev.marcelolabs.bohtreinar;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutTimerPlugin.class);   // notificação do treino com cronômetro (fase 2)
        super.onCreate(savedInstanceState);
    }
}

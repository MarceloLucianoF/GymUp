package dev.marcelolabs.bohtreinar;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Ponte JS ↔ notificação do treino (WorkoutTimerService). Uso no app: src/services/workoutTimerNative.js. */
@CapacitorPlugin(name = "WorkoutTimer")
public class WorkoutTimerPlugin extends Plugin {
    @Override
    public void load() {
        WorkoutTimerService.listener = (action) -> {
            JSObject data = new JSObject();
            data.put("action", action);
            notifyListeners("action", data, true);   // guarda o evento se o app ainda não estiver ouvindo
        };
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent i = new Intent(getContext(), WorkoutTimerService.class).setAction(WorkoutTimerService.ACTION_UPDATE)
            .putExtra("title", call.getString("title", "Treino em andamento"))
            .putExtra("body", call.getString("body", ""))
            .putExtra("alertTitle", call.getString("alertTitle", "Descanso acabou"))
            .putExtra("endsAt", call.getLong("endsAt", 0L));
        try { WorkoutTimerService.send(getContext(), i); call.resolve(); }
        catch (Exception e) { call.reject("Não foi possível mostrar a notificação do treino.", e); }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { getContext().startService(new Intent(getContext(), WorkoutTimerService.class).setAction(WorkoutTimerService.ACTION_STOP)); } catch (Exception ignored) { }
        call.resolve();
    }
}
